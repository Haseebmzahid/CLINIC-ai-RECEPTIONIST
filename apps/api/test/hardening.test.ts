import express from "express";
import request from "supertest";
import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { getDb } from "../src/integrations/firebase";
import {
  createRateLimit,
  errorHandler,
  type TokenVerifier,
} from "../src/middleware";
import { requestContext } from "../src/middleware/request-context";
import { AuditLogRepository, PatientRepository } from "../src/repositories";
import { createServer } from "../src/server";

const shouldRunEmulatorTests = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const runId = `hardening_${Date.now()}`;
const clinicA = `clinic_a_${runId}`;
const clinicB = `clinic_b_${runId}`;

const tokenClaims: Record<string, Record<string, unknown>> = {
  owner_a: { uid: "owner_a", tenantId: clinicA, role: "owner" },
  owner_b: { uid: "owner_b", tenantId: clinicB, role: "owner" },
  platform_admin: { uid: "platform_admin", role: "platform_admin" },
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

const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});

const TenantResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: z.enum(["active", "suspended", "trial"]),
});
const AdminHealthResponseSchema = z.object({
  status: z.literal("ok"),
});

function rateLimitProbeServer() {
  const app = express();

  app.use(requestContext);
  app.get(
    "/limited",
    createRateLimit({
      limit: 1,
      windowMs: 60_000,
      key: (req) => req.ip ?? "unknown",
    }),
    (_request, response) => {
      response.status(200).json({ ok: true });
    },
  );
  app.use(errorHandler);

  return app;
}

describe("hardening middleware", () => {
  it("returns RATE_LIMITED with Retry-After guidance", async () => {
    const app = rateLimitProbeServer();

    expect((await request(app).get("/limited")).status).toBe(200);
    const response = await request(app).get("/limited");

    expect(response.status).toBe(429);
    expect(response.header["retry-after"]).toBeDefined();
    expect(ErrorEnvelopeSchema.parse(response.body).error.code).toBe("RATE_LIMITED");
  });
});

describe.skipIf(!shouldRunEmulatorTests)("hardening with Firestore", () => {
  const app = createServer({ tokenVerifier });

  it("onboards and updates a second tenant through platform-admin endpoints", async () => {
    const response = await request(app)
      .post("/api/admin/tenants")
      .set("Authorization", "Bearer platform_admin")
      .send({
        id: clinicB,
        name: "Clinic B",
        slug: "clinic-b",
        status: "trial",
        whatsapp: {
          phoneNumberId: `phone_${clinicB}`,
          displayPhone: "+1 555 0200",
          wabaId: `waba_${clinicB}`,
          accessTokenRef: `secret://${clinicB}`,
        },
        subscription: {
          plan: "professional",
          seats: 3,
          renewsAt: "2027-06-15T00:00:00.000Z",
        },
      });

    expect(response.status).toBe(201);
    expect(TenantResponseSchema.parse(response.body)).toMatchObject({
      id: clinicB,
      status: "trial",
    });

    const updateResponse = await request(app)
      .patch(`/api/admin/tenants/${clinicB}`)
      .set("Authorization", "Bearer platform_admin")
      .send({ status: "active" });

    expect(updateResponse.status).toBe(200);
    expect(TenantResponseSchema.parse(updateResponse.body).status).toBe("active");

    const healthResponse = await request(app)
      .get("/api/admin/health")
      .set("Authorization", "Bearer platform_admin");

    expect(healthResponse.status).toBe(200);
    expect(AdminHealthResponseSchema.parse(healthResponse.body).status).toBe("ok");
  });

  it("writes immutable audit logs for staff mutations", async () => {
    const serviceResponse = await request(app)
      .post("/api/services")
      .set("Authorization", "Bearer owner_a")
      .send({
        name: "Hardening Checkup",
        durationMinutes: 30,
        fee: 12000,
        currency: "USD",
      });

    expect(serviceResponse.status).toBe(201);

    const logs = await new AuditLogRepository(getDb()).list(clinicA, 20);
    expect(logs.some((log) => log.data.action === "service.create")).toBe(true);
    expect(logs.every((log) => log.data.actorUid)).toBe(true);
  });

  it("prevents clinic_a API and repository access from seeing clinic_b data", async () => {
    const db = getDb();
    const patients = new PatientRepository(db);
    await patients.create(clinicB, "pat_b_private", {
      waId: "15550200",
      phone: "+15550200",
      name: "Bea Private",
      nameLower: "bea private",
      notes: "Clinic B only",
      createdAt: Timestamp.fromDate(new Date("2026-06-17T00:00:00.000Z")),
      lastSeenAt: Timestamp.fromDate(new Date("2026-06-17T00:00:00.000Z")),
    });

    const apiResponse = await request(app)
      .get("/api/patients")
      .query({ q: "+15550200" })
      .set("Authorization", "Bearer owner_a");

    expect(apiResponse.status).toBe(200);
    expect(apiResponse.body).toEqual([]);
    expect(await patients.getById(clinicA, "pat_b_private")).toBeNull();
  });

  it("keeps Firestore rules tenant-scoped", async () => {
    const rules = await import("node:fs/promises").then((fs) =>
      fs.readFile("firestore.rules", "utf8"),
    );

    expect(rules).toContain("request.auth.token.tenantId == tid");
    expect(rules).toContain("request.auth.token.role == 'platform_admin'");
  });
});
