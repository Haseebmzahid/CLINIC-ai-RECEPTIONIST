import type { Resource } from "@clinic-ai/shared";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { getDb } from "../src/integrations/firebase";
import type { TokenVerifier } from "../src/middleware";
import { ResourceRepository } from "../src/repositories";
import { createServer } from "../src/server";

const shouldRunEmulatorTests = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const runId = `book_${Date.now()}`;
const tenantId = `clinic_${runId}`;

const tokenVerifier: TokenVerifier = {
  verifyIdToken(token) {
    if (token !== "owner") {
      throw new Error("Invalid token");
    }

    return Promise.resolve({ uid: "owner", tenantId, role: "owner" });
  },
};

const app = createServer({ tokenVerifier });
const auth = { Authorization: "Bearer owner" };
let serviceId = "";
let patientId = "";

const AppointmentResponseSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  serviceId: z.string(),
  resourceId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.string(),
});

const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
  }),
});

const SlotSchema = z.object({
  slotId: z.string(),
  serviceId: z.string(),
  resourceId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
});

const resource: Resource = {
  name: "Room 1",
  type: "room",
  active: true,
};

describe.skipIf(!shouldRunEmulatorTests)("booking and availability API", () => {
  beforeAll(async () => {
    process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "clinic-ai-test";

    await new ResourceRepository(getDb()).create(tenantId, "res_default", resource);

    await request(app)
      .put("/api/settings")
      .set(auth)
      .send({
        timezone: "America/Los_Angeles",
        locale: "en",
        location: { address: "123 Test St" },
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
        bufferMinutes: 15,
        minLeadTimeMinutes: 0,
        holidays: ["2099-01-21"],
      });

    const serviceResponse = await request(app).post("/api/services").set(auth).send({
      name: "Cleaning",
      durationMinutes: 30,
      fee: 10000,
      currency: "USD",
    });
    const patientResponse = await request(app)
      .post("/api/patients")
      .set(auth)
      .send({
        name: "Patient A",
        phone: `+1555${runId}`,
      });

    serviceId = z.object({ id: z.string() }).parse(serviceResponse.body).id;
    patientId = z.object({ id: z.string() }).parse(patientResponse.body).id;
  });

  it("generates slots, books transactionally, lists, cancels, and reopens the slot", async () => {
    const availabilityResponse = await request(app)
      .get("/api/availability")
      .set(auth)
      .query({ serviceId, from: "2099-01-19", to: "2099-01-20" });

    expect(availabilityResponse.status).toBe(200);
    const initialSlots = z.array(SlotSchema).parse(availabilityResponse.body);
    expect(initialSlots.length).toBeGreaterThan(0);

    const targetSlot = SlotSchema.parse(initialSlots[0]);
    const createResponse = await request(app).post("/api/appointments").set(auth).send({
      serviceId,
      patientId,
      startsAt: targetSlot.startsAt,
    });

    expect(createResponse.status).toBe(201);
    const appointment = AppointmentResponseSchema.parse(createResponse.body);
    expect(appointment.status).toBe("confirmed");

    const listResponse = await request(app)
      .get("/api/appointments")
      .set(auth)
      .query({ from: "2099-01-19T00:00:00.000Z", to: "2099-01-20T00:00:00.000Z" });

    expect(listResponse.status).toBe(200);
    expect(
      z
        .array(AppointmentResponseSchema)
        .parse(listResponse.body)
        .map((item) => item.id),
    ).toContain(appointment.id);

    const blockedAvailabilityResponse = await request(app)
      .get("/api/availability")
      .set(auth)
      .query({ serviceId, from: "2099-01-19", to: "2099-01-20" });
    const blockedSlots = z.array(SlotSchema).parse(blockedAvailabilityResponse.body);

    expect(blockedSlots.map((slot) => slot.startsAt)).not.toContain(targetSlot.startsAt);

    const deleteResponse = await request(app)
      .delete(`/api/appointments/${appointment.id}`)
      .set(auth);
    expect(deleteResponse.status).toBe(204);

    const reopenedAvailabilityResponse = await request(app)
      .get("/api/availability")
      .set(auth)
      .query({ serviceId, from: "2099-01-19", to: "2099-01-20" });
    const reopenedSlots = z.array(SlotSchema).parse(reopenedAvailabilityResponse.body);

    expect(reopenedSlots.map((slot) => slot.startsAt)).toContain(targetSlot.startsAt);
  });

  it("allows exactly one concurrent booking for the same slot", async () => {
    const availabilityResponse = await request(app)
      .get("/api/availability")
      .set(auth)
      .query({ serviceId, from: "2099-01-20", to: "2099-01-21" });
    const [targetSlot] = z.array(SlotSchema).parse(availabilityResponse.body);

    expect(targetSlot).toBeDefined();
    const slot = SlotSchema.parse(targetSlot);

    const [firstResponse, secondResponse] = await Promise.all([
      request(app).post("/api/appointments").set(auth).send({
        serviceId,
        patientId,
        startsAt: slot.startsAt,
      }),
      request(app).post("/api/appointments").set(auth).send({
        serviceId,
        patientId,
        startsAt: slot.startsAt,
      }),
    ]);
    const statuses = [firstResponse.status, secondResponse.status].sort();

    expect(statuses).toEqual([201, 409]);
    expect(
      [firstResponse, secondResponse].some((response) => {
        if (response.status !== 409) {
          return false;
        }

        return ErrorEnvelopeSchema.parse(response.body).error.code === "SLOT_TAKEN";
      }),
    ).toBe(true);
  });

  it("rejects cancelling a past appointment", async () => {
    const createResponse = await request(app).post("/api/appointments").set(auth).send({
      serviceId,
      patientId,
      startsAt: "2000-01-19T17:00:00.000Z",
    });
    const appointment = AppointmentResponseSchema.parse(createResponse.body);
    const deleteResponse = await request(app)
      .delete(`/api/appointments/${appointment.id}`)
      .set(auth);

    expect(createResponse.status).toBe(201);
    expect(deleteResponse.status).toBe(403);
  });
});
