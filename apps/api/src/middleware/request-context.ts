import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

function writeLog(
  level: "info" | "warn" | "error",
  request: Request,
  message: string,
  fields: Record<string, unknown> = {},
): void {
  const logRecord = {
    level,
    message,
    requestId: request.requestId,
    tenantId: request.ctx?.tenantId ?? request.auth?.tenantId,
    ...fields,
  };

  const serialized = JSON.stringify(logRecord);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

export function requestContext(request: Request, _response: Response, next: NextFunction): void {
  request.requestId = `req_${randomUUID()}`;
  request.log = {
    info: (message, fields) => writeLog("info", request, message, fields),
    warn: (message, fields) => writeLog("warn", request, message, fields),
    error: (message, fields) => writeLog("error", request, message, fields),
  };

  next();
}
