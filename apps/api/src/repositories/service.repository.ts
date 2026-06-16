import type { Service } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";

import { TenantCollectionRepository } from "./base.repository";

export class ServiceRepository extends TenantCollectionRepository<Service> {
  constructor(db: Firestore) {
    super(db, "services");
  }

  async listActive(tenantId: string): Promise<Array<{ id: string; data: Service }>> {
    return this.getQueryResults(this.collection(tenantId).where("active", "==", true));
  }
}
