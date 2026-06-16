import { createHmac } from "node:crypto";

import type { Appointment, Message, Service, SettingsProfile, Tenant } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import {
  WhatsAppGraphClient,
  type WhatsAppFetch,
  type WhatsAppGraphSendResult,
  type WhatsAppSecretProvider,
} from "../src/integrations/whatsapp";
import { getDb } from "../src/integrations/firebase";
import { WhatsAppStatusProcessor } from "../src/jobs";
import {
  AppointmentRepository,
  ConversationRepository,
  ServiceRepository,
  SettingsRepository,
  TenantRepository,
} from "../src/repositories";
import { createServer } from "../src/server";
import {
  ConversationService,
  type WhatsAppOutboundClient,
} from "../src/services/conversation.service";

const shouldRunEmulatorTests = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const runId = `out_${Date.now()}`;
const appSecret = "outbound_app_secret";

class StaticSecretProvider implements WhatsAppSecretProvider {
  getSecret(): string {
    return "graph_token";
  }
}

class FakeOutboundClient implements WhatsAppOutboundClient {
  public textBodies: string[] = [];
  public templateNames: string[] = [];
  public shouldFail = false;

  sendText(): Promise<WhatsAppGraphSendResult> {
    this.textBodies.push("sent");

    if (this.shouldFail) {
      return Promise.reject(new Error("Graph failed"));
    }

    return Promise.resolve({ waMessageId: `wamid.${runId}.text`, usedTemplate: false });
  }

  sendTemplate(
    _tenant: Tenant,
    _toWaId: string,
    templateName: string,
  ): Promise<WhatsAppGraphSendResult> {
    this.templateNames.push(templateName);

    if (this.shouldFail) {
      return Promise.reject(new Error("Graph failed"));
    }

    return Promise.resolve({ waMessageId: `wamid.${runId}.template`, usedTemplate: true });
  }
}

function signatureFor(rawBody: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(Buffer.from(rawBody)).digest("hex")}`;
}

function tenantDoc(phoneNumberId: string): Tenant {
  const now = Timestamp.fromDate(new Date("2026-06-16T00:00:00.000Z"));

  return {
    name: "Outbound Clinic",
    slug: "outbound-clinic",
    status: "active",
    whatsapp: {
      phoneNumberId,
      displayPhone: "+1 555 0100",
      wabaId: "waba_outbound",
      accessTokenRef: "secret://wa_outbound",
    },
    subscription: {
      plan: "professional",
      seats: 5,
      renewsAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function settingsDoc(): SettingsProfile {
  return {
    timezone: "America/Los_Angeles",
    locale: "en-US",
    location: { address: "123 Care Ave" },
    workingHours: {
      "0": [],
      "1": [{ open: "09:00", close: "17:00" }],
      "2": [{ open: "09:00", close: "17:00" }],
      "3": [{ open: "09:00", close: "17:00" }],
      "4": [{ open: "09:00", close: "17:00" }],
      "5": [{ open: "09:00", close: "17:00" }],
      "6": [],
    },
    slotLengthMinutes: 30,
    bufferMinutes: 0,
    minLeadTimeMinutes: 0,
    holidays: [],
  };
}

describe("WhatsApp Graph client", () => {
  it("retries transient failures then succeeds", async () => {
    const statuses = [500, 200];
    const fetchImpl: WhatsAppFetch = () => {
      const status = statuses.shift() ?? 200;

      return Promise.resolve({
        ok: status === 200,
        status,
        text: () => Promise.resolve(JSON.stringify({ messages: [{ id: "wamid.retry" }] })),
      });
    };
    const client = new WhatsAppGraphClient({
      fetchImpl,
      secretProvider: new StaticSecretProvider(),
      sleep: () => Promise.resolve(),
      random: () => 0,
    });

    const result = await client.sendText(tenantDoc("phone_retry"), "15550101", "Hello");

    expect(result).toEqual({ waMessageId: "wamid.retry", usedTemplate: false });
    expect(statuses).toEqual([]);
  });
});

describe.skipIf(!shouldRunEmulatorTests)("WhatsApp outbound messaging", () => {
  let tenantId: string;
  let phoneNumberId: string;
  let conversationId: string;
  let conversations: ConversationRepository;
  let fakeClient: FakeOutboundClient;

  beforeEach(async () => {
    process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "clinic-ai-test";
    const db = getDb();
    const suffix = `${runId}_${Math.random().toString(16).slice(2)}`;
    tenantId = `clinic_${suffix}`;
    phoneNumberId = `phone_${suffix}`;
    conversationId = `conv_${suffix}`;
    conversations = new ConversationRepository(db);
    fakeClient = new FakeOutboundClient();

    await new TenantRepository(db).create(tenantId, tenantDoc(phoneNumberId));
    await conversations.create(tenantId, conversationId, {
      patientId: `pat_${suffix}`,
      waId: "15550101",
      state: "scheduling",
      aiPaused: false,
      needsHuman: false,
      summary: "",
      context: {},
      lastInboundAt: Timestamp.fromDate(new Date("2099-01-18T10:00:00.000Z")),
      updatedAt: Timestamp.fromDate(new Date("2099-01-18T10:00:00.000Z")),
    });
  });

  function service(now = new Date("2099-01-18T10:30:00.000Z")): ConversationService {
    const db = getDb();

    return new ConversationService(
      new TenantRepository(db),
      conversations,
      new AppointmentRepository(db),
      new ServiceRepository(db),
      new SettingsRepository(db),
      fakeClient,
      () => now,
    );
  }

  it("successful send stores waMessageId and status sent", async () => {
    const result = await service().sendConversationText(tenantId, conversationId, "Hello");
    const message = await conversations.getMessageById(tenantId, conversationId, result.messageId);

    expect(result.status).toBe("sent");
    expect(message?.data).toMatchObject({
      direction: "out",
      waMessageId: `wamid.${runId}.text`,
      status: "sent",
      text: "Hello",
    });
  });

  it("permanent failure marks the outbound message failed and surfaces it for staff", async () => {
    fakeClient.shouldFail = true;

    const result = await service().sendConversationText(tenantId, conversationId, "Hello");
    const [message, conversation] = await Promise.all([
      conversations.getMessageById(tenantId, conversationId, result.messageId),
      conversations.getById(tenantId, conversationId),
    ]);

    expect(result.status).toBe("failed");
    expect(message?.data.status).toBe("failed");
    expect(conversation?.data.needsHuman).toBe(true);
  });

  it("status webhook updates message status", async () => {
    await conversations.createMessage(tenantId, conversationId, "msg_status", {
      direction: "out",
      channel: "whatsapp",
      waMessageId: "wamid.status",
      type: "text",
      text: "Hello",
      author: "ai",
      status: "sent",
      createdAt: Timestamp.fromDate(new Date("2099-01-18T10:30:00.000Z")),
    } satisfies Message);
    const app = createServer({
      whatsappStatusProcessor: new WhatsAppStatusProcessor(getDb()),
      whatsappAppSecret: appSecret,
      whatsappVerifyToken: "verify",
    });
    const rawBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: phoneNumberId },
                statuses: [{ id: "wamid.status", status: "delivered", timestamp: "4072434600" }],
              },
            },
          ],
        },
      ],
    });

    const response = await request(app)
      .post("/api/webhooks/whatsapp")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signatureFor(rawBody))
      .send(rawBody);

    expect(response.status).toBe(200);

    await expect
      .poll(async () => {
        const message = await conversations.getMessageById(tenantId, conversationId, "msg_status");
        return message?.data.status;
      })
      .toBe("delivered");
  });

  it("outside 24-hour window uses a template instead of free-form text", async () => {
    const result = await service(new Date("2099-01-20T10:30:00.000Z")).sendConversationText(
      tenantId,
      conversationId,
      "Your appointment is confirmed.",
    );

    expect(result.usedTemplate).toBe(true);
    expect(fakeClient.templateNames).toEqual(["appointment_confirmation"]);
    expect(fakeClient.textBodies).toEqual([]);
  });

  it("booking confirmation includes date, time, service, location and sets state booked", async () => {
    const db = getDb();
    const appointmentId = `appt_${runId}`;
    const startsAt = Timestamp.fromDate(new Date("2099-01-19T18:30:00.000Z"));
    const appointment: Appointment = {
      patientId: "pat_confirmation",
      serviceId: "svc_cleaning",
      resourceId: "res_room",
      startsAt,
      endsAt: Timestamp.fromDate(new Date("2099-01-19T19:00:00.000Z")),
      status: "confirmed",
      source: "whatsapp",
      createdBy: "ai_service",
      createdAt: startsAt,
      updatedAt: startsAt,
    };
    const clinicService: Service = {
      name: "Cleaning",
      durationMinutes: 30,
      fee: 10000,
      currency: "USD",
      active: true,
    };

    await new AppointmentRepository(db).create(tenantId, appointmentId, appointment);
    await new ServiceRepository(db).create(tenantId, "svc_cleaning", clinicService);
    await new SettingsRepository(db).setProfile(tenantId, settingsDoc());

    const result = await service().sendBookingConfirmation(tenantId, conversationId, appointmentId);
    const [message, conversation] = await Promise.all([
      conversations.getMessageById(tenantId, conversationId, result.messageId),
      conversations.getById(tenantId, conversationId),
    ]);

    expect(message?.data.text).toContain("Cleaning");
    expect(message?.data.text).toContain("123 Care Ave");
    expect(message?.data.text).toContain("Jan 19, 2099");
    expect(message?.data.text).toContain("10:30 AM");
    expect(conversation?.data.state).toBe("booked");
  });
});
