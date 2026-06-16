import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { TokenVerifier } from "../src/middleware";
import { createServer } from "../src/server";

const shouldRunEmulatorTests = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const runId = `t${Date.now()}`;
const clinicA = `clinic_a_${runId}`;
const clinicB = `clinic_b_${runId}`;

const tokenClaims: Record<string, Record<string, unknown>> = {
  owner_a: { uid: "owner_a", tenantId: clinicA, role: "owner" },
  staff_a: { uid: "staff_a", tenantId: clinicA, role: "staff" },
  owner_b: { uid: "owner_b", tenantId: clinicB, role: "owner" },
};

const tokenVerifier: TokenVerifier = {
  verifyIdToken(token) {
    const claims = tokenClaims[token];

    if (!claims) {
      throw new Error("Invalid token");
    }

    return Promise.resolve(claims);
  },
};

const app = createServer({ tokenVerifier });

const ResourceResponseSchema = z.object({
  id: z.string(),
});

const ServiceResponseSchema = ResourceResponseSchema.extend({
  name: z.string(),
  durationMinutes: z.number(),
  fee: z.number(),
  currency: z.string(),
  active: z.boolean(),
});

const FaqResponseSchema = ResourceResponseSchema.extend({
  question: z.string(),
  answer: z.string(),
  tags: z.array(z.string()),
  active: z.boolean(),
  updatedAt: z.string(),
});

const PatientResponseSchema = ResourceResponseSchema.extend({
  name: z.string(),
  nameLower: z.string(),
  phone: z.string(),
  waId: z.string(),
  notes: z.string(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
});

const PatientDetailResponseSchema = z.object({
  patient: PatientResponseSchema,
  appointments: z.array(z.object({ id: z.string() }).passthrough()),
});

const SettingsResponseSchema = z.object({
  timezone: z.string(),
  locale: z.string(),
  location: z.object({
    address: z.string(),
    mapsUrl: z.string().optional(),
  }),
  workingHours: z.record(
    z.string(),
    z.array(
      z.object({
        open: z.string(),
        close: z.string(),
      }),
    ),
  ),
  slotLengthMinutes: z.number(),
  bufferMinutes: z.number(),
  minLeadTimeMinutes: z.number(),
  holidays: z.array(z.string()),
});

const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});

const settingsPayload = {
  timezone: "Asia/Karachi",
  locale: "en",
  location: {
    address: "12 Mall Rd, Lahore",
    mapsUrl: "https://maps.example.com/clinic",
  },
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
  bufferMinutes: 5,
  minLeadTimeMinutes: 120,
  holidays: ["2026-06-28"],
};

describe.skipIf(!shouldRunEmulatorTests)("core domain API", () => {
  it("supports service CRUD happy paths", async () => {
    const createResponse = await request(app)
      .post("/api/services")
      .set("Authorization", "Bearer owner_a")
      .send({
        name: "Dental Cleaning",
        durationMinutes: 30,
        fee: 350000,
        currency: "PKR",
      });

    expect(createResponse.status).toBe(201);
    const created = ServiceResponseSchema.parse(createResponse.body);
    expect(created.active).toBe(true);

    const updateResponse = await request(app)
      .patch(`/api/services/${created.id}`)
      .set("Authorization", "Bearer owner_a")
      .send({ fee: 360000 });

    expect(updateResponse.status).toBe(200);
    expect(ServiceResponseSchema.parse(updateResponse.body).fee).toBe(360000);

    const listResponse = await request(app)
      .get("/api/services")
      .set("Authorization", "Bearer staff_a");

    expect(listResponse.status).toBe(200);
    expect(
      z
        .array(ServiceResponseSchema)
        .parse(listResponse.body)
        .some((item) => item.id === created.id),
    ).toBe(true);
  });

  it("supports settings read and update, with staff blocked from editing profile", async () => {
    const forbiddenResponse = await request(app)
      .put("/api/settings")
      .set("Authorization", "Bearer staff_a")
      .send(settingsPayload);

    expect(forbiddenResponse.status).toBe(403);
    expect(ErrorEnvelopeSchema.parse(forbiddenResponse.body).error.code).toBe("FORBIDDEN");

    const putResponse = await request(app)
      .put("/api/settings")
      .set("Authorization", "Bearer owner_a")
      .send(settingsPayload);

    expect(putResponse.status).toBe(200);
    expect(SettingsResponseSchema.parse(putResponse.body).timezone).toBe("Asia/Karachi");

    const getResponse = await request(app)
      .get("/api/settings")
      .set("Authorization", "Bearer staff_a");

    expect(getResponse.status).toBe(200);
    expect(SettingsResponseSchema.parse(getResponse.body).slotLengthMinutes).toBe(30);
  });

  it("supports FAQ CRUD happy paths", async () => {
    const createResponse = await request(app)
      .post("/api/faqs")
      .set("Authorization", "Bearer staff_a")
      .send({
        question: "What are your timings?",
        answer: "Mon-Fri, 9am-5pm.",
        tags: ["hours"],
      });

    expect(createResponse.status).toBe(201);
    const created = FaqResponseSchema.parse(createResponse.body);

    const patchResponse = await request(app)
      .patch(`/api/faqs/${created.id}`)
      .set("Authorization", "Bearer staff_a")
      .send({ answer: "Mon-Sat, 9am-5pm." });

    expect(patchResponse.status).toBe(200);
    expect(FaqResponseSchema.parse(patchResponse.body).answer).toBe("Mon-Sat, 9am-5pm.");

    const listResponse = await request(app).get("/api/faqs").set("Authorization", "Bearer staff_a");

    expect(listResponse.status).toBe(200);
    expect(
      z
        .array(FaqResponseSchema)
        .parse(listResponse.body)
        .some((item) => item.id === created.id),
    ).toBe(true);

    const deleteResponse = await request(app)
      .delete(`/api/faqs/${created.id}`)
      .set("Authorization", "Bearer staff_a");

    expect(deleteResponse.status).toBe(204);
  });

  it("supports patient CRUD, detail, search, and tenant isolation", async () => {
    const uniqueName = `Sara ${runId}`;
    const createAResponse = await request(app)
      .post("/api/patients")
      .set("Authorization", "Bearer staff_a")
      .send({
        name: uniqueName,
        phone: `+1555${runId}`,
        notes: "Prefers mornings.",
      });
    const createBResponse = await request(app)
      .post("/api/patients")
      .set("Authorization", "Bearer owner_b")
      .send({
        name: uniqueName,
        phone: `+1666${runId}`,
      });

    expect(createAResponse.status).toBe(201);
    expect(createBResponse.status).toBe(201);
    const patientA = PatientResponseSchema.parse(createAResponse.body);
    const patientB = PatientResponseSchema.parse(createBResponse.body);

    const patchResponse = await request(app)
      .patch(`/api/patients/${patientA.id}`)
      .set("Authorization", "Bearer staff_a")
      .send({ notes: "Updated note." });

    expect(patchResponse.status).toBe(200);
    expect(PatientResponseSchema.parse(patchResponse.body).notes).toBe("Updated note.");

    const detailResponse = await request(app)
      .get(`/api/patients/${patientA.id}`)
      .set("Authorization", "Bearer staff_a");

    expect(detailResponse.status).toBe(200);
    expect(PatientDetailResponseSchema.parse(detailResponse.body).patient.id).toBe(patientA.id);

    const nameSearchResponse = await request(app)
      .get("/api/patients")
      .query({ q: uniqueName.toLowerCase().slice(0, 8) })
      .set("Authorization", "Bearer staff_a");
    const phoneSearchResponse = await request(app)
      .get("/api/patients")
      .query({ q: `+1555${runId}` })
      .set("Authorization", "Bearer staff_a");

    const nameResults = z.array(PatientResponseSchema).parse(nameSearchResponse.body);
    const phoneResults = z.array(PatientResponseSchema).parse(phoneSearchResponse.body);

    expect(nameResults.some((item) => item.id === patientA.id)).toBe(true);
    expect(nameResults.some((item) => item.id === patientB.id)).toBe(false);
    expect(phoneResults.map((item) => item.id)).toContain(patientA.id);
    expect(phoneResults.map((item) => item.id)).not.toContain(patientB.id);
  });

  it("returns 400 VALIDATION_ERROR with field details", async () => {
    const response = await request(app)
      .post("/api/services")
      .set("Authorization", "Bearer owner_a")
      .send({
        name: "",
        durationMinutes: 0,
        fee: -1,
        currency: "PKR",
      });

    const body = ErrorEnvelopeSchema.parse(response.body);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeDefined();
  });
});
