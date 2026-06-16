import { createHmac, timingSafeEqual } from "node:crypto";

import type { Tenant } from "@clinic-ai/shared";
import { z } from "zod";

import { AppError } from "../utils";

const WHATSAPP_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v20.0";
const DEFAULT_TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en_US";
const TRANSIENT_RETRY_DELAYS_MS = [250, 1_000] as const;

const WhatsAppTextMessageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  type: z.string().min(1),
  text: z
    .object({
      body: z.string(),
    })
    .optional(),
  timestamp: z.string().min(1),
});

const WhatsAppContactSchema = z.object({
  wa_id: z.string().min(1),
  profile: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
});

const WhatsAppWebhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            metadata: z.object({
              phone_number_id: z.string().min(1),
            }),
            contacts: z.array(WhatsAppContactSchema).optional(),
            messages: z.array(WhatsAppTextMessageSchema).optional(),
            statuses: z
              .array(
                z.object({
                  id: z.string().min(1),
                  status: z.enum(["sent", "delivered", "read", "failed"]),
                  timestamp: z.string().min(1).optional(),
                }),
              )
              .optional(),
          }),
        }),
      ),
    }),
  ),
});

const GraphMessageResponseSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string().min(1),
    }),
  ),
});

export interface NormalizedInboundMessageEvent {
  phoneNumberId: string;
  waId: string;
  profileName?: string;
  messageId: string;
  messageType: "text" | "unsupported";
  text: string;
  timestamp: Date;
}

export interface NormalizedWhatsAppStatusEvent {
  phoneNumberId: string;
  waMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: Date;
}

export interface WhatsAppGraphSendResult {
  waMessageId: string;
  usedTemplate: boolean;
}

export interface WhatsAppSecretProvider {
  getSecret(reference: string): Promise<string | null> | string | null;
}

export type WhatsAppFetch = (
  input: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export class EnvWhatsAppSecretProvider implements WhatsAppSecretProvider {
  getSecret(reference: string): string | null {
    const envName = reference.startsWith("env:") ? reference.slice("env:".length) : reference;
    return process.env[envName] ?? null;
  }
}

export interface WhatsAppGraphClientOptions {
  fetchImpl?: WhatsAppFetch;
  secretProvider?: WhatsAppSecretProvider;
  graphVersion?: string;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryDelayMs(baseDelayMs: number, random: () => number): number {
  return baseDelayMs + Math.floor(random() * 100);
}

function parseGraphMessageResponse(body: string): string {
  const parsed = GraphMessageResponseSchema.parse(JSON.parse(body) as unknown);
  const message = parsed.messages[0];

  if (!message) {
    throw new AppError("UPSTREAM_WA_ERROR", 502, "WhatsApp did not return a message id.");
  }

  return message.id;
}

function tokenFromReference(reference: string): string | null {
  if (reference.startsWith("secret://")) {
    return null;
  }

  return reference;
}

export class WhatsAppGraphClient {
  private readonly fetchImpl: WhatsAppFetch;
  private readonly secretProvider: WhatsAppSecretProvider;
  private readonly graphVersion: string;
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(options: WhatsAppGraphClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.secretProvider = options.secretProvider ?? new EnvWhatsAppSecretProvider();
    this.graphVersion = options.graphVersion ?? WHATSAPP_GRAPH_VERSION;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
  }

  async sendText(tenant: Tenant, toWaId: string, body: string): Promise<WhatsAppGraphSendResult> {
    const waMessageId = await this.postMessage(tenant, {
      messaging_product: "whatsapp",
      to: toWaId,
      type: "text",
      text: { body },
    });

    return { waMessageId, usedTemplate: false };
  }

  async sendTemplate(
    tenant: Tenant,
    toWaId: string,
    templateName: string,
    languageCode = DEFAULT_TEMPLATE_LANGUAGE,
  ): Promise<WhatsAppGraphSendResult> {
    const waMessageId = await this.postMessage(tenant, {
      messaging_product: "whatsapp",
      to: toWaId,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    });

    return { waMessageId, usedTemplate: true };
  }

  private async postMessage(tenant: Tenant, payload: Record<string, unknown>): Promise<string> {
    const accessToken = await this.resolveAccessToken(tenant.whatsapp.accessTokenRef);
    const url = `https://graph.facebook.com/${this.graphVersion}/${tenant.whatsapp.phoneNumberId}/messages`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const text = await response.text();

        if (response.ok) {
          return parseGraphMessageResponse(text);
        }

        lastError = new AppError("UPSTREAM_WA_ERROR", 502, "WhatsApp send failed.", {
          status: response.status,
        });

        if (!isTransientStatus(response.status) || attempt === TRANSIENT_RETRY_DELAYS_MS.length) {
          throw lastError;
        }
      } catch (error) {
        lastError = error;

        if (error instanceof AppError) {
          break;
        }

        if (attempt === TRANSIENT_RETRY_DELAYS_MS.length) {
          break;
        }
      } finally {
        clearTimeout(timeout);
      }

      await this.sleep(retryDelayMs(TRANSIENT_RETRY_DELAYS_MS[attempt] ?? 1_000, this.random));
    }

    if (lastError instanceof AppError) {
      throw lastError;
    }

    throw new AppError("UPSTREAM_WA_ERROR", 502, "WhatsApp send failed.");
  }

  private async resolveAccessToken(reference: string): Promise<string> {
    const literalToken = tokenFromReference(reference);

    if (literalToken) {
      return literalToken;
    }

    const secret = await this.secretProvider.getSecret(reference);

    if (!secret) {
      throw new AppError("UPSTREAM_WA_ERROR", 502, "WhatsApp access token is unavailable.");
    }

    return secret;
  }
}

export function verifyWhatsAppSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  appSecret: string | undefined,
): void {
  if (!rawBody || !signatureHeader || !appSecret) {
    throw new AppError("UNAUTHENTICATED", 401, "Invalid WhatsApp signature.");
  }

  const [algorithm, signature] = signatureHeader.split("=");

  if (algorithm !== "sha256" || !signature) {
    throw new AppError("UNAUTHENTICATED", 401, "Invalid WhatsApp signature.");
  }

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new AppError("UNAUTHENTICATED", 401, "Invalid WhatsApp signature.");
  }
}

export function parseWhatsAppInboundMessages(payload: unknown): NormalizedInboundMessageEvent[] {
  const parsed = WhatsAppWebhookPayloadSchema.parse(payload);
  const events: NormalizedInboundMessageEvent[] = [];

  for (const entry of parsed.entry) {
    for (const change of entry.changes) {
      const contactsByWaId = new Map(
        (change.value.contacts ?? []).map((contact) => [contact.wa_id, contact]),
      );

      for (const message of change.value.messages ?? []) {
        const contact = contactsByWaId.get(message.from);
        const timestampSeconds = Number(message.timestamp);
        const timestamp = Number.isFinite(timestampSeconds)
          ? new Date(timestampSeconds * 1000)
          : new Date();

        events.push({
          phoneNumberId: change.value.metadata.phone_number_id,
          waId: message.from,
          profileName: contact?.profile?.name,
          messageId: message.id,
          messageType: message.type === "text" ? "text" : "unsupported",
          text: message.text?.body ?? "",
          timestamp,
        });
      }
    }
  }

  return events;
}

export function parseWhatsAppStatusEvents(payload: unknown): NormalizedWhatsAppStatusEvent[] {
  const parsed = WhatsAppWebhookPayloadSchema.parse(payload);
  const events: NormalizedWhatsAppStatusEvent[] = [];

  for (const entry of parsed.entry) {
    for (const change of entry.changes) {
      for (const status of change.value.statuses ?? []) {
        const timestampSeconds = Number(status.timestamp);
        const timestamp = Number.isFinite(timestampSeconds)
          ? new Date(timestampSeconds * 1000)
          : new Date();

        events.push({
          phoneNumberId: change.value.metadata.phone_number_id,
          waMessageId: status.id,
          status: status.status,
          timestamp,
        });
      }
    }
  }

  return events;
}
