import type { Tenant } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";

import type { RepositoryDocument, RepositoryUpdate } from "./base.repository";

export class TenantRepository {
  constructor(private readonly db: Firestore) {}

  async create(tenantId: string, data: Tenant): Promise<RepositoryDocument<Tenant>> {
    await this.db.collection("tenants").doc(tenantId).set(data);
    return { id: tenantId, data };
  }

  async getById(tenantId: string): Promise<RepositoryDocument<Tenant> | null> {
    const snapshot = await this.db.collection("tenants").doc(tenantId).get();

    if (!snapshot.exists) {
      return null;
    }

    return { id: snapshot.id, data: snapshot.data() as Tenant };
  }

  async update(tenantId: string, data: RepositoryUpdate<Tenant>): Promise<void> {
    await this.db.collection("tenants").doc(tenantId).update(data);
  }

  async delete(tenantId: string): Promise<void> {
    await this.db.collection("tenants").doc(tenantId).delete();
  }

  async findByWhatsappPhoneNumberId(
    phoneNumberId: string,
  ): Promise<RepositoryDocument<Tenant> | null> {
    const snapshot = await this.db
      .collection("tenants")
      .where("whatsapp.phoneNumberId", "==", phoneNumberId)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];

    if (!doc) {
      return null;
    }

    return { id: doc.id, data: doc.data() as Tenant };
  }
}
