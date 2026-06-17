import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { logger, metrics } from "../observability";

function requestFields(request: Request, fields: Record<string, unknown> = {}) {
  return {
    requestId: request.requestId,
    tenantId: request.ctx?.tenantId ?? request.auth?.tenantId,
    ...fields,
  };
}

export function requestContext(request: Request, response: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  request.requestId = `req_${randomUUID()}`;
  request.log = {
    info: (message, fields) => logger.info(requestFields(request, fields), message),
    warn: (message, fields) => logger.warn(requestFields(request, fields), message),
    error: (message, fields) => logger.error(requestFields(request, fields), message),
  };

  response.on("finish", () => {
    const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    metrics.observeHttpRequest(response.statusCode, latencyMs);
    request.log.info("http.request", {
      latencyMs,
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
    });
  });

  next();
}
