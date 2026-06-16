import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  errorHandler,
  requireAuth,
  requireTenantContext,
  requireTenantParam,
  type TokenVerifier,
} from "../src/middleware";
import { requestContext } from "../src/middleware/request-context";
import { createServer } from "../src/server";

const tokenClaims: Record<string, Record<string, unknown>> = {
  valid_clinic_a_staff: {
    uid: "user_clinic_a",
    tenantId: "clinic_a",
    role: "staff",
  },
  valid_clinic_a_owner: {
    uid: "owner_clinic_a",
    tenantId: "clinic_a",
    role: "owner",
  },
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
  }),
});

const MeResponseSchema = z.object({
  uid: z.string(),
  role: z.string(),
  tenantId: z.string(),
});

const ProbeBodySchema = z.object({
  tenantId: z.string().optional(),
});

const ProbeResponseSchema = z.object({
  bodyTenantId: z.string().optional(),
  ctxTenantId: z.string(),
});

function createTenantProbeServer() {
  const app = express();

  app.use(requestContext);
  app.use(express.json());
  app.get(
    "/api/tenants/:tenantId/probe",
    requireAuth(tokenVerifier),
    requireTenantContext,
    requireTenantParam("tenantId"),
    (request, response) => {
      response.status(200).json(request.ctx);
    },
  );
  app.post("/api/probe", requireAuth(tokenVerifier), requireTenantContext, (request, response) => {
    const body = ProbeBodySchema.parse(request.body);

    response.status(200).json({
      bodyTenantId: body.tenantId,
      ctxTenantId: request.ctx?.tenantId,
    });
  });
  app.use(errorHandler);

  return app;
}

describe("auth middleware", () => {
  it("allows a valid token through GET /api/me and populates request context", async () => {
    const response = await request(createServer({ tokenVerifier }))
      .get("/api/me")
      .set("Authorization", "Bearer valid_clinic_a_staff");

    expect(response.status).toBe(200);
    expect(MeResponseSchema.parse(response.body)).toEqual({
      uid: "user_clinic_a",
      role: "staff",
      tenantId: "clinic_a",
    });
  });

  it("returns 401 for a missing token", async () => {
    const response = await request(createServer({ tokenVerifier })).get("/api/me");

    expect(response.status).toBe(401);
    const body = ErrorEnvelopeSchema.parse(response.body);

    expect(body.error).toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Missing bearer token.",
    });
    expect(body.error.requestId).toMatch(/^req_/);
  });

  it("returns 401 for an invalid token", async () => {
    const response = await request(createServer({ tokenVerifier }))
      .get("/api/me")
      .set("Authorization", "Bearer definitely_bad");

    expect(response.status).toBe(401);
    expect(ErrorEnvelopeSchema.parse(response.body).error).toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Invalid bearer token.",
    });
  });

  it("returns 403 when clinic_a user calls a clinic_b tenant path", async () => {
    const response = await request(createTenantProbeServer())
      .get("/api/tenants/clinic_b/probe")
      .set("Authorization", "Bearer valid_clinic_a_staff");

    expect(response.status).toBe(403);
    expect(ErrorEnvelopeSchema.parse(response.body).error).toMatchObject({
      code: "FORBIDDEN",
      message: "Tenant access is forbidden.",
    });
  });

  it("ignores client-supplied tenantId in the body", async () => {
    const response = await request(createTenantProbeServer())
      .post("/api/probe")
      .set("Authorization", "Bearer valid_clinic_a_owner")
      .send({ tenantId: "clinic_b" });

    expect(response.status).toBe(200);
    expect(ProbeResponseSchema.parse(response.body)).toEqual({
      bodyTenantId: "clinic_b",
      ctxTenantId: "clinic_a",
    });
  });
});
