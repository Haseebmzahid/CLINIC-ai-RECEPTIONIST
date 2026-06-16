import type { AuditLog } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";

import { TenantCollectionRepository } from "./base.repository";

export class AuditLogRepository extends TenantCollectionRepository<AuditLog> {
  constructor(db: Firestore) {
    super(db, "auditLogs");
  }
}
