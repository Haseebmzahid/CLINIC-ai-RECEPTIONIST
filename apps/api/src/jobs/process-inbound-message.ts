import { createHash } from "node:crypto";

import type { Conversation, Message, Patient } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

import type { NormalizedInboundMessageEvent } from "../integrations/whatsapp";
import {
  ConversationRepository,
  PatientRepository,
  TenantRepository,
  WebhookEventRepository,
} from "../repositories";

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

export class InboundMessageProcessor {
  private readonly tenants: TenantRepository;
  private readonly patients: PatientRepository;
  private readonly conversations: ConversationRepository;
  private readonly webhookEvents: WebhookEventRepository;
  private readonly tenantCache = new Map<string, TenantCacheEntry>();

  constructor(
    db: Firestore,
    private readonly logger: InboundWorkerLogger = console,
    private readonly tenantCacheTtlMs = 60_000,
  ) {
    this.tenants = new TenantRepository(db);
    this.patients = new PatientRepository(db);
    this.conversations = new ConversationRepository(db);
    this.webhookEvents = new WebhookEventRepository(db);
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

    if (!conversation.data.aiPaused) {
      this.logger.info("Inbound WhatsApp message ready for AI", {
        tenantId,
        conversationId: conversation.id,
      });
    }
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
}
