import type {
  Conversation,
  Patient,
  Resource,
  Service,
  SettingsProfile,
  Tenant,
} from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";

import { AiOrchestrator } from "../src/ai/orchestrator";
import type { AiChatRequest, AiChatResponse, AiClient } from "../src/integrations/openai";
import { getDb } from "../src/integrations/firebase";
import {
  AppointmentRepository,
  ConversationRepository,
  PatientRepository,
  ResourceRepository,
  ServiceRepository,
  SettingsRepository,
  TenantRepository,
} from "../src/repositories";
import { createDomainServices, type DomainServices } from "../src/services";
import { AppError } from "../src/utils";

const shouldRunEmulatorTests = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const runId = `ai_${Date.now()}`;
const tenantId = `clinic_${runId}`;
const conversationId = `conv_${runId}`;
const patientId = `pat_${runId}`;
const serviceId = `svc_${runId}`;
const resourceId = `res_${runId}`;

class ScriptedAiClient implements AiClient {
  calls: AiChatRequest[] = [];

  constructor(
    private readonly responder: (request: AiChatRequest, callIndex: number) => AiChatResponse,
  ) {}

  createChatCompletion(request: AiChatRequest): Promise<AiChatResponse> {
    this.calls.push(request);
    return Promise.resolve(this.responder(request, this.calls.length - 1));
  }
}

function now(): Timestamp {
  return Timestamp.fromDate(new Date("2099-01-01T00:00:00.000Z"));
}

function tenant(): Tenant {
  return {
    name: "AI Test Clinic",
    slug: tenantId,
    status: "active",
    whatsapp: {
      phoneNumberId: `phone_${runId}`,
      displayPhone: "+15550100",
      wabaId: "waba_ai",
      accessTokenRef: "secret://wa_ai",
    },
    subscription: { plan: "professional", seats: 5, renewsAt: now() },
    createdAt: now(),
    updatedAt: now(),
  };
}

function settings(): SettingsProfile {
  return {
    timezone: "America/Los_Angeles",
    locale: "en",
    location: { address: "123 Clinic Ave" },
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

function patient(): Patient {
  return {
    waId: `1555${runId}`,
    phone: `+1555${runId}`,
    name: "Sara",
    nameLower: "sara",
    notes: "",
    lastSeenAt: now(),
    createdAt: now(),
  };
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    patientId,
    waId: patient().waId,
    state: "greeting",
    aiPaused: false,
    needsHuman: false,
    summary: "",
    context: {},
    lastInboundAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

async function seedBase(): Promise<{
  db: FirebaseFirestore.Firestore;
  conversations: ConversationRepository;
  services: DomainServices;
}> {
  const db = getDb();

  await new TenantRepository(db).create(tenantId, tenant());
  await new SettingsRepository(db).setProfile(tenantId, settings());
  await new ServiceRepository(db).create(tenantId, serviceId, service());
  await new ResourceRepository(db).create(tenantId, resourceId, resource());
  await new PatientRepository(db).create(tenantId, patientId, patient());
  await new ConversationRepository(db).create(tenantId, conversationId, conversation());

  return {
    db,
    conversations: new ConversationRepository(db),
    services: createDomainServices(db),
  };
}

function slotIdFromLastToolMessage(request: AiChatRequest): string {
  const toolMessage = [...request.messages].reverse().find((message) => message.role === "tool");
  const parsed = JSON.parse(toolMessage?.content ?? "{}") as { slots?: Array<{ slotId: string }> };
  const slotId = parsed.slots?.[0]?.slotId;

  if (!slotId) {
    throw new Error("Expected a slotId in the previous tool result.");
  }

  return slotId;
}

describe.skipIf(!shouldRunEmulatorTests)("AiOrchestrator", () => {
  beforeEach(() => {
    process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "clinic-ai-test";
  });

  it("runs booking intent through availability and booking tools and marks conversation booked", async () => {
    const seeded = await seedBase();
    const client = new ScriptedAiClient((request, callIndex) => {
      if (callIndex === 0) {
        return {
          message: {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "call_avail",
                name: "get_availability",
                argumentsJson: JSON.stringify({
                  serviceId,
                  fromISO: "2099-01-19",
                  toISO: "2099-01-20",
                }),
              },
            ],
          },
        };
      }

      if (callIndex === 1) {
        return {
          message: {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "call_book",
                name: "book_appointment",
                argumentsJson: JSON.stringify({
                  slotId: slotIdFromLastToolMessage(request),
                  serviceId,
                  patientName: "Sara",
                }),
              },
            ],
          },
        };
      }

      return { message: { role: "assistant", content: "You're booked for a cleaning." } };
    });
    const orchestrator = new AiOrchestrator({
      client,
      db: seeded.db,
      services: seeded.services,
      today: new Date("2099-01-18T12:00:00.000Z"),
    });

    const result = await orchestrator.runTurn({
      tenantId,
      conversationId,
      patientText: "Can I book a cleaning?",
    });
    const updated = await seeded.conversations.getById(tenantId, conversationId);
    const appointments = await new AppointmentRepository(seeded.db).findByPatientId(
      tenantId,
      patientId,
    );

    expect(result.state).toBe("booked");
    expect(updated?.data.state).toBe("booked");
    expect(appointments).toHaveLength(1);
    expect(client.calls[0]?.messages[0]?.role).toBe("system");
    expect(
      client.calls[0]?.messages.some(
        (message) => message.role === "user" && message.content === "Can I book a cleaning?",
      ),
    ).toBe(true);
  });

  it("refuses medical advice and does not call the model", async () => {
    const seeded = await seedBase();
    const client = new ScriptedAiClient(() => {
      throw new Error("OpenAI should not be called for medical advice.");
    });
    const orchestrator = new AiOrchestrator({
      client,
      db: seeded.db,
      services: seeded.services,
    });

    const result = await orchestrator.runTurn({
      tenantId,
      conversationId,
      patientText: "Can you diagnose this swelling and tell me medicine dosage?",
    });
    const updated = await seeded.conversations.getById(tenantId, conversationId);

    expect(result.reply).toContain("not able to give medical advice");
    expect(result.needsHuman).toBe(true);
    expect(updated?.data.needsHuman).toBe(true);
    expect(client.calls).toHaveLength(0);
  });

  it("passes SLOT_TAKEN tool result back so the model offers alternatives", async () => {
    const seeded = await seedBase();
    const conflictServices: DomainServices = {
      ...seeded.services,
      appointments: {
        ...seeded.services.appointments,
        create: () => {
          throw new AppError("SLOT_TAKEN", 409, "Slot taken.");
        },
      } as never,
    };
    const client = new ScriptedAiClient((request, callIndex) => {
      if (callIndex === 0) {
        return {
          message: {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "call_avail",
                name: "get_availability",
                argumentsJson: JSON.stringify({
                  serviceId,
                  fromISO: "2099-01-19",
                  toISO: "2099-01-20",
                }),
              },
            ],
          },
        };
      }

      if (callIndex === 1) {
        return {
          message: {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "call_book",
                name: "book_appointment",
                argumentsJson: JSON.stringify({
                  slotId: slotIdFromLastToolMessage(request),
                  serviceId,
                  patientName: "Sara",
                }),
              },
            ],
          },
        };
      }

      const lastToolContent = request.messages.at(-1)?.content ?? "";
      expect(lastToolContent).toContain("SLOT_TAKEN");
      return {
        message: {
          role: "assistant",
          content: "Sorry, that time was just taken. I can offer another available slot.",
        },
      };
    });
    const orchestrator = new AiOrchestrator({
      client,
      db: seeded.db,
      services: conflictServices,
    });

    const result = await orchestrator.runTurn({
      tenantId,
      conversationId,
      patientText: "Book that slot please.",
    });

    expect(result.reply).toContain("another available slot");
    expect(result.state).toBe("scheduling");
  });

  it("handoff tool sets needsHuman and pauses AI", async () => {
    const seeded = await seedBase();
    const client = new ScriptedAiClient((_request, callIndex) => {
      if (callIndex === 0) {
        return {
          message: {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "call_handoff",
                name: "handoff_to_human",
                argumentsJson: JSON.stringify({ reason: "Patient requested staff" }),
              },
            ],
          },
        };
      }

      return { message: { role: "assistant", content: "I'll have the clinic team help you." } };
    });
    const orchestrator = new AiOrchestrator({
      client,
      db: seeded.db,
      services: seeded.services,
    });

    const result = await orchestrator.runTurn({
      tenantId,
      conversationId,
      patientText: "Please transfer me.",
    });
    const updated = await seeded.conversations.getById(tenantId, conversationId);

    expect(result.state).toBe("handoff");
    expect(result.needsHuman).toBe(true);
    expect(result.aiPaused).toBe(true);
    expect(updated?.data.needsHuman).toBe(true);
    expect(updated?.data.aiPaused).toBe(true);
  });
});
