import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

import type { NormalizedWhatsAppStatusEvent } from "../integrations/whatsapp";
import { hashIdentifier, metrics, structuredWorkerLogger } from "../observability";
import { ConversationRepository, TenantRepository } from "../repositories";

interface TenantCacheEntry {
  tenantId: string;
  expiresAt: number;
}

export interface WhatsAppStatusLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
}

export class WhatsAppStatusProcessor {
  private readonly tenants: TenantRepository;
  private readonly conversations: ConversationRepository;
  private readonly tenantCache = new Map<string, TenantCacheEntry>();

  constructor(
    db: Firestore,
    private readonly logger: WhatsAppStatusLogger = structuredWorkerLogger,
    private readonly tenantCacheTtlMs = 60_000,
  ) {
    this.tenants = new TenantRepository(db);
    this.conversations = new ConversationRepository(db);
  }

  async process(event: NormalizedWhatsAppStatusEvent): Promise<void> {
    const tenantId = await this.resolveTenantId(event.phoneNumberId);

    if (!tenantId) {
      this.logger.warn("Unknown WhatsApp phone_number_id; dropping status event", {
        phoneNumberIdHash: hashIdentifier(event.phoneNumberId),
      });
      return;
    }

    const message = await this.conversations.findMessageByWaMessageId(tenantId, event.waMessageId);

    if (!message) {
      this.logger.warn("WhatsApp status did not match an outbound message", {
        tenantId,
        waMessageId: event.waMessageId,
      });
      return;
    }

    await this.conversations.updateMessage(tenantId, message.conversationId, message.id, {
      status: event.status,
    });

    if (event.status === "failed") {
      metrics.incrementWhatsappSendFailure();
      await this.conversations.update(tenantId, message.conversationId, {
        needsHuman: true,
        updatedAt: Timestamp.fromDate(event.timestamp),
      });
    }

    this.logger.info("WhatsApp message status updated", {
      tenantId,
      conversationId: message.conversationId,
      status: event.status,
    });
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
}
