import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { AppError } from "../utils";

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
          }),
        }),
      ),
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
