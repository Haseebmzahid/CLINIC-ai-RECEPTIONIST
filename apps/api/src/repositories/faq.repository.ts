import type { Faq } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";

import { TenantCollectionRepository } from "./base.repository";

export class FaqRepository extends TenantCollectionRepository<Faq> {
  constructor(db: Firestore) {
    super(db, "faqs");
  }

  async listActive(tenantId: string): Promise<Array<{ id: string; data: Faq }>> {
    return this.getQueryResults(this.collection(tenantId).where("active", "==", true));
  }
}
