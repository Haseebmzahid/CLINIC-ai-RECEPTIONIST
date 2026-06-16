import type { Resource } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";

import { TenantCollectionRepository } from "./base.repository";

export class ResourceRepository extends TenantCollectionRepository<Resource> {
  constructor(db: Firestore) {
    super(db, "resources");
  }

  async listActive(tenantId: string): Promise<Array<{ id: string; data: Resource }>> {
    return this.getQueryResults(this.collection(tenantId).where("active", "==", true));
  }
}
