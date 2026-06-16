import { randomUUID } from "node:crypto";

import type { Conversation, Message, Tenant } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";

import type { RepositoryDocument } from "../repositories";
import {
  AppointmentRepository,
  ConversationRepository,
  ServiceRepository,
  SettingsRepository,
  TenantRepository,
} from "../repositories";
import type { WhatsAppGraphSendResult } from "../integrations/whatsapp";
import { WhatsAppGraphClient } from "../integrations/whatsapp";
import { AppError } from "../utils";

const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1_000;
const CONFIRMATION_TEMPLATE_NAME =
  process.env.WHATSAPP_CONFIRMATION_TEMPLATE_NAME ?? "appointment_confirmation";
const TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en_US";

export interface WhatsAppOutboundClient {
  sendText(tenant: Tenant, toWaId: string, body: string): Promise<WhatsAppGraphSendResult>;
  sendTemplate(
    tenant: Tenant,
    toWaId: string,
    templateName: string,
    languageCode?: string,
  ): Promise<WhatsAppGraphSendResult>;
}

export interface SendConversationTextResult {
  messageId: string;
  waMessageId?: string;
  status: "sent" | "failed";
  usedTemplate: boolean;
}

export interface ConversationMessageDto {
  id: string;
  direction: Message["direction"];
  channel: Message["channel"];
  waMessageId?: string;
  type: Message["type"];
  text: string;
  author: Message["author"];
  status: Message["status"];
  createdAt: Timestamp;
}

export interface ConversationSummary {
  id: string;
  patientId: string;
  waId: string;
  state: string;
  aiPaused: boolean;
  needsHuman: boolean;
  updatedAt: Timestamp;
}

function isWithinCustomerServiceWindow(lastInboundAt: Timestamp, now: Date): boolean {
  return now.getTime() - lastInboundAt.toMillis() <= CUSTOMER_SERVICE_WINDOW_MS;
}

function messageId(): string {
  return `msg_${randomUUID()}`;
}

function formatAppointmentDateTime(startsAt: Date, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(startsAt);
}

export class ConversationService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly conversations: ConversationRepository,
    private readonly appointments: AppointmentRepository,
    private readonly services: ServiceRepository,
    private readonly settings: SettingsRepository,
    private readonly whatsapp: WhatsAppOutboundClient = new WhatsAppGraphClient(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async listSummaries(
    tenantId: string,
    state?: Conversation["state"],
  ): Promise<ConversationSummary[]> {
    const conversations = (await this.conversations.listRecent(tenantId, 100)).filter(
      (conversation) => !state || conversation.data.state === state,
    );

    return conversations.map((conversation) => ({
      id: conversation.id,
      patientId: conversation.data.patientId,
      waId: conversation.data.waId,
      state: conversation.data.state,
      aiPaused: conversation.data.aiPaused,
      needsHuman: conversation.data.needsHuman,
      updatedAt: conversation.data.updatedAt,
    }));
  }

  async listMessages(tenantId: string, conversationId: string): Promise<ConversationMessageDto[]> {
    const conversation = await this.conversations.getById(tenantId, conversationId);

    if (!conversation) {
      throw new AppError("NOT_FOUND", 404, "Conversation was not found.");
    }

    const messages = await this.conversations.listMessages(tenantId, conversationId);

    return messages.map((message) => ({
      id: message.id,
      ...message.data,
    }));
  }

  async updateAiPaused(
    tenantId: string,
    conversationId: string,
    aiPaused: boolean,
  ): Promise<ConversationSummary> {
    const existing = await this.conversations.getById(tenantId, conversationId);

    if (!existing) {
      throw new AppError("NOT_FOUND", 404, "Conversation was not found.");
    }

    const now = Timestamp.fromDate(this.clock());

    await this.conversations.update(tenantId, conversationId, {
      aiPaused,
      needsHuman: aiPaused ? true : false,
      state: aiPaused
        ? "handoff"
        : existing.data.state === "handoff"
          ? "browsing"
          : existing.data.state,
      updatedAt: now,
    });

    return {
      id: conversationId,
      patientId: existing.data.patientId,
      waId: existing.data.waId,
      state: aiPaused
        ? "handoff"
        : existing.data.state === "handoff"
          ? "browsing"
          : existing.data.state,
      aiPaused,
      needsHuman: aiPaused,
      updatedAt: now,
    };
  }

  async sendConversationText(
    tenantId: string,
    conversationId: string,
    body: string,
    author: Message["author"] = "ai",
  ): Promise<SendConversationTextResult> {
    const [tenant, conversation] = await Promise.all([
      this.tenants.getById(tenantId),
      this.conversations.getById(tenantId, conversationId),
    ]);

    if (!tenant) {
      throw new AppError("NOT_FOUND", 404, "Tenant was not found.");
    }

    if (!conversation) {
      throw new AppError("NOT_FOUND", 404, "Conversation was not found.");
    }

    const now = Timestamp.fromDate(this.clock());
    const id = messageId();
    const outboundMessage: Message = {
      direction: "out",
      channel: "whatsapp",
      type: "text",
      text: body,
      author,
      status: "sent",
      createdAt: now,
    };

    await this.conversations.createMessage(tenantId, conversationId, id, outboundMessage);
    await this.conversations.update(tenantId, conversationId, { updatedAt: now });

    const shouldUseTemplate = !isWithinCustomerServiceWindow(
      conversation.data.lastInboundAt,
      this.clock(),
    );

    try {
      const sent = shouldUseTemplate
        ? await this.whatsapp.sendTemplate(
            tenant.data,
            conversation.data.waId,
            CONFIRMATION_TEMPLATE_NAME,
            TEMPLATE_LANGUAGE,
          )
        : await this.whatsapp.sendText(tenant.data, conversation.data.waId, body);

      await this.conversations.updateMessage(tenantId, conversationId, id, {
        waMessageId: sent.waMessageId,
        status: "sent",
      });

      return {
        messageId: id,
        waMessageId: sent.waMessageId,
        status: "sent",
        usedTemplate: sent.usedTemplate,
      };
    } catch {
      await Promise.all([
        this.conversations.updateMessage(tenantId, conversationId, id, { status: "failed" }),
        this.conversations.update(tenantId, conversationId, {
          needsHuman: true,
          updatedAt: now,
        }),
      ]);

      return {
        messageId: id,
        status: "failed",
        usedTemplate: shouldUseTemplate,
      };
    }
  }

  async sendStaffConversationText(
    tenantId: string,
    conversationId: string,
    body: string,
  ): Promise<SendConversationTextResult> {
    return this.sendConversationText(tenantId, conversationId, body, "staff");
  }

  async sendBookingConfirmation(
    tenantId: string,
    conversationId: string,
    appointmentId: string,
  ): Promise<SendConversationTextResult> {
    const [appointment, service, profile] = await this.loadBookingConfirmationData(
      tenantId,
      appointmentId,
    );
    const dateTime = formatAppointmentDateTime(
      appointment.data.startsAt.toDate(),
      profile.data.timezone,
      profile.data.locale,
    );
    const body = `You're booked for ${dateTime} for ${service.data.name}. Clinic location: ${profile.data.location.address}.`;
    const result = await this.sendConversationText(tenantId, conversationId, body);

    await this.conversations.update(tenantId, conversationId, {
      state: "booked",
      updatedAt: Timestamp.fromDate(this.clock()),
    });

    return result;
  }

  private async loadBookingConfirmationData(
    tenantId: string,
    appointmentId: string,
  ): Promise<
    [
      RepositoryDocument<import("@clinic-ai/shared").Appointment>,
      RepositoryDocument<import("@clinic-ai/shared").Service>,
      RepositoryDocument<import("@clinic-ai/shared").SettingsProfile>,
    ]
  > {
    const appointment = await this.appointments.getById(tenantId, appointmentId);

    if (!appointment) {
      throw new AppError("NOT_FOUND", 404, "Appointment was not found.");
    }

    const [service, profile] = await Promise.all([
      this.services.getById(tenantId, appointment.data.serviceId),
      this.settings.getProfile(tenantId),
    ]);

    if (!service) {
      throw new AppError("NOT_FOUND", 404, "Service was not found.");
    }

    if (!profile) {
      throw new AppError("NOT_FOUND", 404, "Settings profile was not found.");
    }

    return [appointment, service, profile];
  }
}
