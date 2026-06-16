import { createHmac } from "node:crypto";

import type { Tenant } from "@clinic-ai/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { getDb } from "../src/integrations/firebase";
import { InboundMessageProcessor, InboundMessageQueue } from "../src/jobs";
import {
  ConversationRepository,
  PatientRepository,
  TenantRepository,
  WebhookEventRepository,
} from "../src/repositories";
import { createServer } from "../src/server";
import { Timestamp } from "firebase-admin/firestore";

const shouldRunEmulatorTests = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const appSecret = "test_app_secret";
const verifyToken = "verify_me";
const runId = `wa_${Date.now()}`;
const phoneNumberId = `phone_${runId}`;
const tenantId = `clinic_${runId}`;

function signatureFor(rawBody: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(Buffer.from(rawBody)).digest("hex")}`;
}

function inboundPayload(
  messageId: string,
  overridePhoneNumberId = phoneNumberId,
  waId = "923001234567",
): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: overridePhoneNumberId },
              contacts: [{ wa_id: waId, profile: { name: "Sara" } }],
              messages: [
                {
                  from: waId,
                  id: messageId,
                  type: "text",
                  text: { body: "Can I book a cleaning?" },
                  timestamp: "1718200000",
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

function tenantDoc(): Tenant {
  const now = Timestamp.fromDate(new Date("2026-06-16T00:00:00.000Z"));

  return {
    name: "Webhook Test Clinic",
    slug: tenantId,
    status: "active",
    whatsapp: {
      phoneNumberId,
      displayPhone: "+92 300 1234567",
      wabaId: "waba_test",
      accessTokenRef: "secret://wa_test",
    },
    subscription: {
      plan: "professional",
      seats: 3,
      renewsAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

describe.skipIf(!shouldRunEmulatorTests)("WhatsApp inbound webhook", () => {
  let queue: InboundMessageQueue;
  let patients: PatientRepository;
  let conversations: ConversationRepository;
  let webhookEvents: WebhookEventRepository;

  beforeEach(async () => {
    process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "clinic-ai-test";
    const db = getDb();

    queue = new InboundMessageQueue(new InboundMessageProcessor(db, { disableAi: true }));
    patients = new PatientRepository(db);
    conversations = new ConversationRepository(db);
    webhookEvents = new WebhookEventRepository(db);

    await new TenantRepository(db).create(tenantId, tenantDoc());
  });

  it("verifies handshake token", async () => {
    const app = createServer({
      whatsappQueue: queue,
      whatsappAppSecret: appSecret,
      whatsappVerifyToken: verifyToken,
    });

    const response = await request(app).get("/api/webhooks/whatsapp").query({
      "hub.mode": "subscribe",
      "hub.verify_token": verifyToken,
      "hub.challenge": "challenge_echo",
    });

    expect(response.status).toBe(200);
    expect(response.text).toBe("challenge_echo");
  });

  it("accepts a valid signature, fast-acks, and persists message state asynchronously", async () => {
    const app = createServer({
      whatsappQueue: queue,
      whatsappAppSecret: appSecret,
      whatsappVerifyToken: verifyToken,
    });
    const rawBody = inboundPayload(`wamid.${runId}.valid`);
    const response = await request(app)
      .post("/api/webhooks/whatsapp")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signatureFor(rawBody))
      .send(rawBody);

    expect(response.status).toBe(200);

    await queue.onIdle();

    const [patient] = await patients.findByWaId(tenantId, "923001234567");
    const [conversation] = await conversations.findByWaId(tenantId, "923001234567");

    expect(patient?.data.name).toBe("Sara");
    expect(conversation?.data.patientId).toBe(patient?.id);

    const messages = await conversations.listMessages(tenantId, conversation?.id ?? "");

    expect(messages).toHaveLength(1);
    expect(messages[0]?.data).toMatchObject({
      direction: "in",
      channel: "whatsapp",
      waMessageId: `wamid.${runId}.valid`,
      type: "text",
      text: "Can I book a cleaning?",
      author: "patient",
      status: "received",
    });
  });

  it("rejects an invalid signature", async () => {
    const app = createServer({
      whatsappQueue: queue,
      whatsappAppSecret: appSecret,
      whatsappVerifyToken: verifyToken,
    });
    const rawBody = inboundPayload(`wamid.${runId}.bad_sig`);
    const response = await request(app)
      .post("/api/webhooks/whatsapp")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", "sha256=bad")
      .send(rawBody);

    expect(response.status).toBe(401);
  });

  it("processes duplicate message ids once", async () => {
    const app = createServer({
      whatsappQueue: queue,
      whatsappAppSecret: appSecret,
      whatsappVerifyToken: verifyToken,
    });
    const messageId = `wamid.${runId}.duplicate`;
    const rawBody = inboundPayload(messageId);

    await request(app)
      .post("/api/webhooks/whatsapp")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signatureFor(rawBody))
      .send(rawBody);
    await request(app)
      .post("/api/webhooks/whatsapp")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signatureFor(rawBody))
      .send(rawBody);
    await queue.onIdle();

    const [conversation] = await conversations.findByWaId(tenantId, "923001234567");
    const messages = await conversations.listMessages(tenantId, conversation?.id ?? "");
    const processedEvents = await webhookEvents.findByExternalId(tenantId, "whatsapp", messageId);

    expect(messages.filter((message) => message.data.waMessageId === messageId)).toHaveLength(1);
    expect(processedEvents).toHaveLength(1);
  });

  it("drops unknown phone_number_id without error", async () => {
    const app = createServer({
      whatsappQueue: queue,
      whatsappAppSecret: appSecret,
      whatsappVerifyToken: verifyToken,
    });
    const unknownWaId = "923009999999";
    const rawBody = inboundPayload(`wamid.${runId}.unknown`, "unknown_phone_id", unknownWaId);
    const response = await request(app)
      .post("/api/webhooks/whatsapp")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signatureFor(rawBody))
      .send(rawBody);

    expect(response.status).toBe(200);

    await queue.onIdle();

    const patientsForKnownTenant = await patients.findByWaId(tenantId, unknownWaId);

    expect(patientsForKnownTenant).toEqual([]);
  });
});
