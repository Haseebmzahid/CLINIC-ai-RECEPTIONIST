import type { Request, Response } from "express";

import { HealthStatusSchema } from "@clinic-ai/shared";

import { captureException, metrics } from "../observability";
import { AppError } from "../utils";

export function getHealth(_request: Request, response: Response) {
  const body = HealthStatusSchema.parse({ status: "ok" });

  response.status(200).json(body);
}

export function getReadiness(_request: Request, response: Response) {
  response.status(200).json({
    status: "ready",
    checks: {
      firebaseProject: Boolean(process.env.FIREBASE_PROJECT_ID),
      node: process.version,
    },
  });
}

export function getMetrics(_request: Request, response: Response) {
  response.status(200).json(metrics.snapshot());
}

export function getSentryTest(request: Request, response: Response) {
  if (process.env.NODE_ENV === "production" && process.env.SENTRY_TEST_ENABLED !== "true") {
    throw new AppError("FORBIDDEN", 403, "Sentry test endpoint is disabled.");
  }

  const error = new Error("Forced Sentry test error");
  const eventId = captureException(error, {
    requestId: request.requestId,
    tenantId: request.ctx?.tenantId ?? request.auth?.tenantId ?? "health",
  });

  response.status(202).json({ captured: Boolean(eventId), eventId });
}
