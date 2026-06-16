import type { Request, Response } from "express";

export function getMe(request: Request, response: Response): void {
  if (!request.ctx) {
    response.status(500).json({
      error: {
        code: "INTERNAL",
        message: "Request context was not initialized.",
        requestId: request.requestId,
      },
    });
    return;
  }

  response.status(200).json({
    uid: request.ctx.uid,
    role: request.ctx.role,
    tenantId: request.ctx.tenantId,
  });
}
