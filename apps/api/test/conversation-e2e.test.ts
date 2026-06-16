import type { Resource, Service, SettingsProfile, Tenant } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";

import type { AiChatRequest, AiChatResponse, AiClient } from "../src/integrations/openai";
import type {
  NormalizedInboundMessageEvent,
  WhatsAppGraphSendResult,
} from "../src/integrations/whatsapp";
import { getDb } from "../src/integrations/firebase";
import { InboundMessageProcessor } from "../src/jobs";
import {
  AppointmentRepository,
  ConversationRepository,
  FaqRepository,
  PatientRepository,
  ResourceRepository,
  ServiceRepository,
  SettingsRepository,
  TenantRepository,
} from "../src/repositories";
import {
  AppointmentService,
  AvailabilityService,
  ClinicServiceService,
  ConversationService,
  FaqService,
  PatientService,
  SettingsService,
  type DomainServices,
} from "../src/services";
import type { WhatsAppOutboundClient } from "../src/services/conversation.service";

const shouldRunEmulatorTests = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const runId = `e2e_${Date.now()}`;

class MockGraphClient implements WhatsAppOutboundClient {
  public sent: Array<{ toWaId: string; body: string; waMessageId: string }> = [];

  sendText(_tenant: Tenant, toWaId: string, body: string): Promise<WhatsAppGraphSendResult> {
    const waMessageId = `wamid.${runId}.${this.sent.length + 1}`;
    this.sent.push({ toWaId, body, waMessageId });
    return Promise.resolve({ waMessageId, usedTemplate: false });
  }

  sendTemplate(): Promise<WhatsAppGraphSendResult> {
    const waMessageId = `wamid.${runId}.template.${this.sent.length + 1}`;
    return Promise.resolve({ waMessageId, usedTemplate: true });
  }
}

class ConversationScriptAiClient implements AiClient {
  public calls: AiChatRequest[] = [];
  public firstOfferedSlotId = "";

  createChatCompletion(request: AiChatRequest): Promise<AiChatResponse> {
    this.calls.push(request);
    const lastMessage = request.messages.at(-1);
    const lastUser = [...request.messages]
      .reverse()
      .find((message) => message.role === "user")
      ?.content.toLowerCase();

    if (lastMessage?.role === "tool" && lastMessage.name === "answer_faq") {
      const parsed = JSON.parse(lastMessage.content) as { answer?: string };
      return Promise.resolve({
        message: { role: "assistant", content: parsed.answer ?? "The clinic team can help." },
      });
    }

    if (lastMessage?.role === "tool" && lastMessage.name === "get_availability") {
      const parsed = JSON.parse(lastMessage.content) as {
        slots?: Array<{ slotId: string; startsAt: string }>;
      };
      const slot = parsed.slots?.[0];

      if (!slot) {
        return Promise.resolve({
          message: { role: "assistant", content: "I couldn't find an open slot." },
        });
      }

      this.firstOfferedSlotId = this.firstOfferedSlotId || slot.slotId;
      return Promise.resolve({
        message: { role: "assistant", content: `I have an opening at ${slot.startsAt}.` },
      });
    }

    if (lastMessage?.role === "tool" && lastMessage.name === "book_appointment") {
      const parsed = JSON.parse(lastMessage.content) as { ok?: boolean; error?: string };

      if (parsed.ok) {
        return Promise.resolve({
          message: { role: "assistant", content: "You're booked." },
        });
      }

      return Promise.resolve({
        message: {
          role: "assistant",
          content:
            parsed.error === "SLOT_TAKEN"
              ? "That time was just taken. Here are other available options."
              : "I couldn't book that time.",
        },
      });
    }

    if (lastUser?.includes("where") || lastUser?.includes("located")) {
      return Promise.resolve({
        message: {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: `call_faq_${this.calls.length}`,
              name: "answer_faq",
              argumentsJson: JSON.stringify({ query: "location" }),
            },
          ],
        },
      });
    }

    if (lastUser?.includes("book") || lastUser?.includes("cleaning")) {
      return Promise.resolve({
        message: {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: `call_availability_${this.calls.length}`,
              name: "get_availability",
              argumentsJson: JSON.stringify({
                serviceId: "svc_cleaning",
                fromISO: "2099-01-19",
                toISO: "2099-01-20",
              }),
            },
          ],
        },
      });
    }

    if (lastUser?.includes("first") || lastUser?.includes("works")) {
      return Promise.resolve({
        message: {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: `call_book_${this.calls.length}`,
              name: "book_appointment",
              argumentsJson: JSON.stringify({
                slotId: this.firstOfferedSlotId,
                serviceId: "svc_cleaning",
                patientName: "Sara",
              }),
            },
          ],
        },
      });
    }

    return Promise.resolve({
      message: { role: "assistant", content: "Hi, thanks for messaging E2E Clinic." },
    });
  }
}

function timestamp(value: string): Timestamp {
  return Timestamp.fromDate(new Date(value));
}

function tenant(tenantId: string, phoneNumberId: string): Tenant {
  return {
    name: "E2E Clinic",
    slug: tenantId,
    status: "active",
    whatsapp: {
      phoneNumberId,
      displayPhone: "+1 555 0100",
      wabaId: "waba_e2e",
      accessTokenRef: "secret://wa_e2e",
    },
    subscription: {
      plan: "professional",
      seats: 5,
      renewsAt: timestamp("2099-01-01T00:00:00.000Z"),
    },
    createdAt: timestamp("2099-01-01T00:00:00.000Z"),
    updatedAt: timestamp("2099-01-01T00:00:00.000Z"),
  };
}

function settings(): SettingsProfile {
  return {
    timezone: "America/Los_Angeles",
    locale: "en-US",
    location: { address: "123 Care Ave" },
    workingHours: {
      "0": [],
      "1": [{ open: "09:00", close: "12:00" }],
      "2": [{ open: "09:00", close: "12:00" }],
      "3": [{ open: "09:00", close: "12:00" }],
      "4": [{ open: "09:00", close: "12:00" }],
      "5": [{ open: "09:00", close: "12:00" }],
      "6": [],
    },
    slotLengthMinutes: 30,
    bufferMinutes: 0,
    minLeadTimeMinutes: 0,
    holidays: [],
  };
}

function service(): Service {
  return {
    name: "Cleaning",
    durationMinutes: 30,
    fee: 10000,
    currency: "USD",
    active: true,
  };
}

function resource(): Resource {
  return { name: "Room 1", type: "room", active: true };
}

function event(
  phoneNumberId: string,
  waId: string,
  messageId: string,
  text: string,
): NormalizedInboundMessageEvent {
  return {
    phoneNumberId,
    waId,
    profileName: "Sara",
    messageId,
    messageType: "text",
    text,
    timestamp: new Date("2099-01-18T10:00:00.000Z"),
  };
}

function buildServices(db: FirebaseFirestore.Firestore, graph: MockGraphClient): DomainServices {
  const appointments = new AppointmentRepository(db);
  const patients = new PatientRepository(db);
  const resources = new ResourceRepository(db);
  const services = new ServiceRepository(db);
  const settingsRepository = new SettingsRepository(db);

  return {
    appointments: new AppointmentService(
      appointments,
      patients,
      services,
      resources,
      settingsRepository,
      () => new Date("2099-01-18T09:00:00.000Z"),
    ),
    availability: new AvailabilityService(
      settingsRepository,
      services,
      resources,
      appointments,
      () => new Date("2099-01-18T09:00:00.000Z"),
    ),
    clinicServices: new ClinicServiceService(services),
    conversations: new ConversationService(
      new TenantRepository(db),
      new ConversationRepository(db),
      appointments,
      services,
      settingsRepository,
      graph,
      () => new Date("2099-01-18T10:05:00.000Z"),
    ),
    faqs: new FaqService(new FaqRepository(db)),
    patients: new PatientService(patients, appointments),
    settings: new SettingsService(settingsRepository),
  };
}

async function seedTenant(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  phoneNumberId: string,
) {
  await new TenantRepository(db).create(tenantId, tenant(tenantId, phoneNumberId));
  await new SettingsRepository(db).setProfile(tenantId, settings());
  await new ServiceRepository(db).create(tenantId, "svc_cleaning", service());
  await new ResourceRepository(db).create(tenantId, "res_room", resource());
  await new FaqRepository(db).create(tenantId, "faq_location", {
    question: "Where are you located?",
    answer: "We are located at 123 Care Ave.",
    tags: ["location"],
    active: true,
    updatedAt: timestamp("2099-01-01T00:00:00.000Z"),
  });
}

describe.skipIf(!shouldRunEmulatorTests)("conversation E2E", () => {
  beforeEach(() => {
    process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "clinic-ai-test";
  });

  it("runs greeting, FAQ, booking, slot selection, transactional booking, and confirmation", async () => {
    const db = getDb();
    const tenantId = `clinic_${runId}_full`;
    const phoneNumberId = `phone_${runId}_full`;
    const graph = new MockGraphClient();
    const aiClient = new ConversationScriptAiClient();
    const processor = new InboundMessageProcessor(db, {
      aiClient,
      services: buildServices(db, graph),
      debounceMs: 0,
    });

    await seedTenant(db, tenantId, phoneNumberId);
    await processor.process(event(phoneNumberId, "15550100", "wamid.full.1", "Hi"));
    await processor.process(
      event(phoneNumberId, "15550100", "wamid.full.2", "Where are you located?"),
    );
    await processor.process(
      event(phoneNumberId, "15550100", "wamid.full.3", "I want to book a cleaning"),
    );
    await processor.process(
      event(phoneNumberId, "15550100", "wamid.full.4", "The first slot works"),
    );

    const conversations = new ConversationRepository(db);
    const [conversation] = await conversations.findByWaId(tenantId, "15550100");
    const appointments = await new AppointmentRepository(db).findByPatientId(
      tenantId,
      conversation?.data.patientId ?? "",
    );
    const messages = await conversations.listMessages(tenantId, conversation?.id ?? "");

    expect(appointments).toHaveLength(1);
    expect(conversation?.data.state).toBe("booked");
    expect(
      messages.some(
        (message) =>
          message.data.direction === "out" &&
          message.data.status === "sent" &&
          message.data.waMessageId,
      ),
    ).toBe(true);
    expect(graph.sent.some((sent) => sent.body.includes("You're booked"))).toBe(true);
  });

  it("handles a conversation-level double-booking race with one confirmation and alternatives", async () => {
    const db = getDb();
    const tenantId = `clinic_${runId}_race`;
    const phoneNumberId = `phone_${runId}_race`;
    const graph = new MockGraphClient();
    const aiClient = new ConversationScriptAiClient();
    const processor = new InboundMessageProcessor(db, {
      aiClient,
      services: buildServices(db, graph),
      debounceMs: 0,
    });

    await seedTenant(db, tenantId, phoneNumberId);
    await Promise.all([
      processor.process(
        event(phoneNumberId, "15550101", "wamid.race.1a", "I want to book cleaning"),
      ),
      processor.process(
        event(phoneNumberId, "15550102", "wamid.race.1b", "I want to book cleaning"),
      ),
    ]);
    await Promise.all([
      processor.process(event(phoneNumberId, "15550101", "wamid.race.2a", "The first slot works")),
      processor.process(event(phoneNumberId, "15550102", "wamid.race.2b", "The first slot works")),
    ]);

    const conversations = new ConversationRepository(db);
    const [firstConversation] = await conversations.findByWaId(tenantId, "15550101");
    const [secondConversation] = await conversations.findByWaId(tenantId, "15550102");
    const firstMessages = await conversations.listMessages(tenantId, firstConversation?.id ?? "");
    const secondMessages = await conversations.listMessages(tenantId, secondConversation?.id ?? "");
    const allMessages = [...firstMessages, ...secondMessages];
    const appointments = [
      ...(await new AppointmentRepository(db).findByPatientId(
        tenantId,
        firstConversation?.data.patientId ?? "",
      )),
      ...(await new AppointmentRepository(db).findByPatientId(
        tenantId,
        secondConversation?.data.patientId ?? "",
      )),
    ];
    const confirmationCount = graph.sent.filter((sent) =>
      sent.body.includes("You're booked"),
    ).length;
    const alternativesCount = allMessages.filter((message) =>
      message.data.text.includes("That time was just taken"),
    ).length;

    expect(appointments).toHaveLength(1);
    expect(confirmationCount).toBe(1);
    expect(alternativesCount).toBe(1);
  });

  it("debounces rapid consecutive inbound messages into one AI turn", async () => {
    const db = getDb();
    const tenantId = `clinic_${runId}_debounce`;
    const phoneNumberId = `phone_${runId}_debounce`;
    const graph = new MockGraphClient();
    const aiClient = new ConversationScriptAiClient();
    const processor = new InboundMessageProcessor(db, {
      aiClient,
      services: buildServices(db, graph),
      debounceMs: 20,
    });

    await seedTenant(db, tenantId, phoneNumberId);
    await Promise.all([
      processor.process(event(phoneNumberId, "15550103", "wamid.debounce.1", "Hi")),
      processor.process(event(phoneNumberId, "15550103", "wamid.debounce.2", "Are you open?")),
    ]);

    expect(aiClient.calls).toHaveLength(1);
    expect(graph.sent).toHaveLength(1);
  });

  it("records staff notification and suppresses auto-reply when AI escalates", async () => {
    const db = getDb();
    const tenantId = `clinic_${runId}_handoff`;
    const phoneNumberId = `phone_${runId}_handoff`;
    const graph = new MockGraphClient();
    const processor = new InboundMessageProcessor(db, {
      aiClient: new ConversationScriptAiClient(),
      services: buildServices(db, graph),
      debounceMs: 0,
    });

    await seedTenant(db, tenantId, phoneNumberId);
    await processor.process(
      event(
        phoneNumberId,
        "15550104",
        "wamid.handoff.1",
        "Can you diagnose this swelling and tell me medicine dosage?",
      ),
    );

    const conversations = new ConversationRepository(db);
    const [conversation] = await conversations.findByWaId(tenantId, "15550104");
    const messages = await conversations.listMessages(tenantId, conversation?.id ?? "");

    expect(graph.sent).toHaveLength(0);
    expect(conversation?.data.needsHuman).toBe(true);
    expect(
      messages.some(
        (message) => message.data.author === "system" && message.data.text.includes("staff review"),
      ),
    ).toBe(true);
  });
});
