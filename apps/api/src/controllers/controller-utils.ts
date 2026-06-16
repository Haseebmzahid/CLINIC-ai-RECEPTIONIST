import type { Request } from "express";

import { AppError } from "../utils";

export function requireRequestTenantId(request: Request): string {
  const tenantId = request.ctx?.tenantId;

  if (!tenantId) {
    throw new AppError("FORBIDDEN", 403, "Tenant context is required.");
  }

  return tenantId;
}
