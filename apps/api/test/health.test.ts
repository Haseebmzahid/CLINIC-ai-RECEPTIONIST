import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createServer } from "../src/server";

const ReadinessSchema = z.object({
  status: z.literal("ready"),
  checks: z.object({
    firebaseProject: z.boolean(),
    node: z.string(),
  }),
});

const MetricsSchema = z.object({
  httpRequestCount: z.number(),
  http5xxCount: z.number(),
  httpRequestLatencyMs: z.object({
    count: z.number(),
    max: z.number(),
    p95: z.number(),
  }),
  webhookQueueDepth: z.number(),
  webhookDlqCount: z.number(),
  whatsappSendFailureCount: z.number(),
  aiErrorCount: z.number(),
  appointmentConflictCount: z.number(),
  tenantUsage: z.record(z.object({ aiTurns: z.number(), messages: z.number() })),
});

const SentryTestSchema = z.object({
  captured: z.boolean(),
  eventId: z.string().optional(),
});

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const response = await request(createServer()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns readiness and metrics", async () => {
    const app = createServer();
    const readiness = await request(app).get("/api/health/ready");
    const metrics = await request(app).get("/api/health/metrics");

    expect(readiness.status).toBe(200);
    expect(ReadinessSchema.parse(readiness.body).status).toBe("ready");
    expect(metrics.status).toBe(200);
    expect(MetricsSchema.parse(metrics.body).httpRequestCount).toBeGreaterThanOrEqual(1);
  });

  it("captures a forced Sentry test event when enabled", async () => {
    const previous = process.env.SENTRY_TEST_ENABLED;
    process.env.SENTRY_TEST_ENABLED = "true";

    const response = await request(createServer()).get("/api/health/sentry-test");

    process.env.SENTRY_TEST_ENABLED = previous;

    expect(response.status).toBe(202);
    expect(typeof SentryTestSchema.parse(response.body).captured).toBe("boolean");
  });
});
