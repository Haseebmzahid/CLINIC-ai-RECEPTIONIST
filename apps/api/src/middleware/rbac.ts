import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRole } from "../types/express";

import { AppError } from "../utils";

export function requireRole(...roles: AuthenticatedRole[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.ctx) {
      next(new AppError("UNAUTHENTICATED", 401, "Request context is required."));
      return;
    }

    if (!roles.includes(request.ctx.role)) {
      next(new AppError("FORBIDDEN", 403, "Role is not permitted."));
      return;
    }

    next();
  };
}
