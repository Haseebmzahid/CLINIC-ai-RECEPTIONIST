import type { WebhookEvent } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";

import { TenantCollectionRepository } from "./base.repository";

export class WebhookEventRepository extends TenantCollectionRepository<WebhookEvent> {
  constructor(db: Firestore) {
    super(db, "webhookEvents");
  }

  async findByExternalId(
    tenantId: string,
    provider: WebhookEvent["provider"],
    externalId: string,
  ): Promise<Array<{ id: string; data: WebhookEvent }>> {
    return this.getQueryResults(
      this.collection(tenantId)
        .where("provider", "==", provider)
        .where("externalId", "==", externalId)
        .limit(1),
    );
  }
}
