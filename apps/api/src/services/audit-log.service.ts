import { randomUUID } from "node:crypto";

import type { AuditLog } from "@clinic-ai/shared";
import { Timestamp } from "firebase-admin/firestore";

import type { AuditLogRepository, RepositoryDocument } from "../repositories";
import type { RequestContext } from "../types/express";
import { AppError } from "../utils";

export interface AuditMutationInput {
  action: string;
  target: string;
  meta?: Record<string, unknown>;
}

export class AuditLogService {
  constructor(private readonly auditLogs: AuditLogRepository) {}

  async recordStaffMutation(
    tenantId: string,
    ctx: RequestContext | undefined,
    input: AuditMutationInput,
  ): Promise<RepositoryDocument<AuditLog>> {
    if (!ctx) {
      throw new AppError("UNAUTHENTICATED", 401, "Request context is required.");
    }

    return this.auditLogs.create(tenantId, `aud_${randomUUID()}`, {
      actorUid: ctx.uid,
      role: ctx.role,
      action: input.action,
      target: input.target,
      meta: input.meta ?? {},
      at: Timestamp.now(),
    });
  }
}
