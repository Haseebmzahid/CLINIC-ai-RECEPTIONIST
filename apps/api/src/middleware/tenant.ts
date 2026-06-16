import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils";

export function requireTenantContext(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  if (!request.auth) {
    next(new AppError("UNAUTHENTICATED", 401, "Authentication is required."));
    return;
  }

  if (request.auth.role !== "platform_admin" && !request.auth.tenantId) {
    next(new AppError("FORBIDDEN", 403, "Tenant claim is required."));
    return;
  }

  request.ctx = {
    uid: request.auth.uid,
    role: request.auth.role,
    tenantId: request.auth.tenantId,
    requestId: request.requestId,
  };

  next();
}

export function requireTenantParam(paramName = "tenantId") {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.ctx) {
      next(new AppError("UNAUTHENTICATED", 401, "Request context is required."));
      return;
    }

    const pathTenantId = request.params[paramName];

    if (!pathTenantId) {
      next(new AppError("VALIDATION_ERROR", 400, "Tenant path parameter is required."));
      return;
    }

    if (request.ctx.role === "platform_admin") {
      request.ctx.tenantId = pathTenantId;
      next();
      return;
    }

    if (request.ctx.tenantId !== pathTenantId) {
      next(new AppError("FORBIDDEN", 403, "Tenant access is forbidden."));
      return;
    }

    next();
  };
}
