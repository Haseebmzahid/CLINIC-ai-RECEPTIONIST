import { createHash } from "node:crypto";

import type { Conversation, Message, Patient } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

import { AiOrchestrator } from "../ai/orchestrator";
import type { AiClient } from "../integrations/openai";
import { UnconfiguredOpenAiClient } from "../integrations/openai";
import type { NormalizedInboundMessageEvent } from "../integrations/whatsapp";
import {
  ConversationRepository,
  PatientRepository,
  TenantRepository,
  WebhookEventRepository,
} from "../repositories";
import { createDomainServices, type DomainServices } from "../services";

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

function normalizeNameLower(name: string): string {
  return name.trim().toLowerCase();
}

function displayNameForEvent(event: NormalizedInboundMessageEvent): string {
  return event.profileName?.trim() || event.waId;
}

interface TenantCacheEntry {
  tenantId: string;
  expiresAt: number;
}

export interface InboundWorkerLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export interface InboundMessageProcessorOptions {
  logger?: InboundWorkerLogger;
  tenantCacheTtlMs?: number;
  debounceMs?: number;
  aiClient?: AiClient;
  services?: DomainServices;
  today?: Date;
  disableAi?: boolean;
}

interface PendingAiTurn {
  timer: NodeJS.Timeout;
  resolve: () => void;
}

function isInboundWorkerLogger(value: unknown): value is InboundWorkerLogger {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.info === "function" &&
    typeof candidate.warn === "function" &&
    typeof candidate.error === "function"
  );
}

export class InboundMessageProcessor {
  private readonly tenants: TenantRepository;
  private readonly patients: PatientRepository;
  private readonly conversations: ConversationRepository;
  private readonly webhookEvents: WebhookEventRepository;
  private readonly tenantCache = new Map<string, TenantCacheEntry>();
  private readonly pendingAiTurns = new Map<string, PendingAiTurn>();
  private readonly logger: InboundWorkerLogger;
  private readonly tenantCacheTtlMs: number;
  private readonly debounceMs: number;
  private readonly services: DomainServices;
  private readonly aiClient: AiClient;
  private readonly disableAi: boolean;

  constructor(
    private readonly db: Firestore,
    optionsOrLogger: InboundMessageProcessorOptions | InboundWorkerLogger = {},
    tenantCacheTtlMs = 60_000,
  ) {
    const options: InboundMessageProcessorOptions = isInboundWorkerLogger(optionsOrLogger)
      ? { logger: optionsOrLogger, tenantCacheTtlMs }
      : optionsOrLogger;

    this.tenants = new TenantRepository(this.db);
    this.patients = new PatientRepository(this.db);
    this.conversations = new ConversationRepository(this.db);
    this.webhookEvents = new WebhookEventRepository(this.db);
    this.logger = options.logger ?? console;
    this.tenantCacheTtlMs = options.tenantCacheTtlMs ?? tenantCacheTtlMs;
    this.debounceMs = options.debounceMs ?? 750;
    this.services = options.services ?? createDomainServices(this.db);
    this.aiClient = options.aiClient ?? new UnconfiguredOpenAiClient();
    this.disableAi = options.disableAi ?? false;
  }

  async process(event: NormalizedInboundMessageEvent): Promise<void> {
    const tenantId = await this.resolveTenantId(event.phoneNumberId);

    if (!tenantId) {
      this.logger.warn("Unknown WhatsApp phone_number_id; dropping inbound event", {
        phoneNumberId: event.phoneNumberId,
      });
      return;
    }

    const processed = await this.webhookEvents.createIfAbsent(
      tenantId,
      stableId("wh_evt", event.messageId),
      {
        provider: "whatsapp",
        externalId: event.messageId,
        processedAt: Timestamp.now(),
      },
    );

    if (!processed) {
      this.logger.info("Duplicate WhatsApp inbound message skipped", { tenantId });
      return;
    }

    const patient = await this.upsertPatient(tenantId, event);
    const conversation = await this.upsertConversation(tenantId, event, patient.id);
    await this.conversations.createMessage(
      tenantId,
      conversation.id,
      stableId("msg", event.messageId),
      this.messageFromEvent(event),
    );

    if (conversation.data.aiPaused || conversation.data.needsHuman) {
      await this.recordStaffNotification(
        tenantId,
        conversation.id,
        `Staff notification: patient replied while AI was paused or escalated.`,
        stableId("staff_note", `${event.messageId}:paused`),
      );
      this.logger.info("Inbound WhatsApp message requires staff attention", {
        tenantId,
        conversationId: conversation.id,
        requestId: event.messageId,
      });
      return;
    }

    if (this.disableAi) {
      this.logger.info("Inbound WhatsApp message ready for AI", {
        tenantId,
        conversationId: conversation.id,
        requestId: event.messageId,
      });
      return;
    }

    await this.scheduleAiTurn(tenantId, conversation.id, event);
  }

  private async resolveTenantId(phoneNumberId: string): Promise<string | null> {
    const cached = this.tenantCache.get(phoneNumberId);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.tenantId;
    }

    const tenant = await this.tenants.findByWhatsappPhoneNumberId(phoneNumberId);

    if (!tenant) {
      return null;
    }

    this.tenantCache.set(phoneNumberId, {
      tenantId: tenant.id,
      expiresAt: now + this.tenantCacheTtlMs,
    });

    return tenant.id;
  }

  private async upsertPatient(
    tenantId: string,
    event: NormalizedInboundMessageEvent,
  ): Promise<{ id: string; data: Patient }> {
    const existing = (await this.patients.findByWaId(tenantId, event.waId))[0];
    const now = Timestamp.fromDate(event.timestamp);
    const name = displayNameForEvent(event);

    if (existing) {
      await this.patients.update(tenantId, existing.id, {
        name,
        nameLower: normalizeNameLower(name),
        lastSeenAt: now,
      });

      const updated = await this.patients.getById(tenantId, existing.id);
      return updated ?? existing;
    }

    const data: Patient = {
      waId: event.waId,
      phone: `+${event.waId}`,
      name,
      nameLower: normalizeNameLower(name),
      notes: "",
      lastSeenAt: now,
      createdAt: now,
    };

    return this.patients.create(tenantId, stableId("pat", event.waId), data);
  }

  private async upsertConversation(
    tenantId: string,
    event: NormalizedInboundMessageEvent,
    patientId: string,
  ): Promise<{ id: string; data: Conversation }> {
    const existing = (await this.conversations.findByWaId(tenantId, event.waId))[0];
    const now = Timestamp.fromDate(event.timestamp);

    if (existing) {
      await this.conversations.update(tenantId, existing.id, {
        patientId,
        lastInboundAt: now,
        updatedAt: now,
      });

      const updated = await this.conversations.getById(tenantId, existing.id);
      return updated ?? existing;
    }

    const data: Conversation = {
      patientId,
      waId: event.waId,
      state: "new",
      aiPaused: false,
      needsHuman: false,
      summary: "",
      context: {},
      lastInboundAt: now,
      updatedAt: now,
    };

    return this.conversations.create(tenantId, stableId("conv", event.waId), data);
  }

  private messageFromEvent(event: NormalizedInboundMessageEvent): Message {
    return {
      direction: "in",
      channel: "whatsapp",
      waMessageId: event.messageId,
      type: event.messageType === "text" ? "text" : "system",
      text: event.text,
      author: "patient",
      status: "received",
      createdAt: Timestamp.fromDate(event.timestamp),
    };
  }

  private scheduleAiTurn(
    tenantId: string,
    conversationId: string,
    event: NormalizedInboundMessageEvent,
  ): Promise<void> {
    const key = `${tenantId}:${conversationId}`;
    const existing = this.pendingAiTurns.get(key);

    if (existing) {
      clearTimeout(existing.timer);
      existing.resolve();
    }

    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingAiTurns.delete(key);
        void this.runAiTurn(tenantId, conversationId, event)
          .catch(async (error: unknown) => {
            await Promise.all([
              this.conversations.update(tenantId, conversationId, {
                needsHuman: true,
                updatedAt: Timestamp.now(),
              }),
              this.recordStaffNotification(
                tenantId,
                conversationId,
                `Staff notification: AI processing failed and needs staff review.`,
                stableId("staff_note", `${event.messageId}:ai_failed`),
              ),
            ]);
            this.logger.error("Inbound AI turn failed", {
              tenantId,
              conversationId,
              requestId: event.messageId,
              errorName: error instanceof Error ? error.name : "UnknownError",
            });
          })
          .finally(resolve);
      }, this.debounceMs);

      this.pendingAiTurns.set(key, { timer, resolve });
    });
  }

  private async runAiTurn(
    tenantId: string,
    conversationId: string,
    event: NormalizedInboundMessageEvent,
  ): Promise<void> {
    this.logger.info("Inbound WhatsApp message ready for AI", {
      tenantId,
      conversationId,
      requestId: event.messageId,
    });

    const patientText = await this.latestPatientText(tenantId, conversationId, event.text);
    const orchestrator = new AiOrchestrator({
      client: this.aiClient,
      services: this.services,
      db: this.db,
      today: event.timestamp,
    });
    const result = await orchestrator.runTurn({
      tenantId,
      conversationId,
      patientText,
    });

    if (result.needsHuman || result.aiPaused) {
      await this.recordStaffNotification(
        tenantId,
        conversationId,
        `Staff notification: AI marked this conversation for staff review.`,
        stableId("staff_note", `${event.messageId}:handoff`),
      );
      return;
    }

    const latestConversation = await this.conversations.getById(tenantId, conversationId);

    if (latestConversation?.data.needsHuman || latestConversation?.data.aiPaused) {
      await this.recordStaffNotification(
        tenantId,
        conversationId,
        `Staff notification: this conversation is paused or escalated.`,
        stableId("staff_note", `${event.messageId}:latest_handoff`),
      );
      return;
    }

    if (latestConversation?.data.context.confirmationMessageId && result.state === "booked") {
      return;
    }

    await this.services.conversations.sendConversationText(tenantId, conversationId, result.reply);
  }

  private async latestPatientText(
    tenantId: string,
    conversationId: string,
    fallbackText: string,
  ): Promise<string> {
    const messages = await this.conversations.listMessages(tenantId, conversationId);
    let lastOutboundIndex = -1;

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.data.direction === "out") {
        lastOutboundIndex = index;
        break;
      }
    }

    const trailingInbound = messages
      .slice(lastOutboundIndex + 1)
      .filter((message) => message.data.direction === "in")
      .map((message) => message.data.text.trim())
      .filter(Boolean);

    return trailingInbound.join("\n") || fallbackText;
  }

  private async recordStaffNotification(
    tenantId: string,
    conversationId: string,
    text: string,
    id: string,
  ): Promise<void> {
    await this.conversations.createMessage(tenantId, conversationId, id, {
      direction: "out",
      channel: "whatsapp",
      type: "system",
      text,
      author: "system",
      status: "sent",
      createdAt: Timestamp.now(),
    });
  }
}
