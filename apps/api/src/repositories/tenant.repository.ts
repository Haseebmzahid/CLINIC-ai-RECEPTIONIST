import type { Tenant } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";

import type { RepositoryDocument, RepositoryUpdate } from "./base.repository";

export class TenantRepository {
  private readonly phoneNumberCache = new Map<
    string,
    { data: RepositoryDocument<Tenant> | null; expiresAt: number }
  >();
  private readonly cacheTtlMs = Number(process.env.TENANT_CACHE_TTL_MS ?? "30000");

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
    this.phoneNumberCache.clear();
  }

  async delete(tenantId: string): Promise<void> {
    await this.db.collection("tenants").doc(tenantId).delete();
    this.phoneNumberCache.clear();
  }

  async findByWhatsappPhoneNumberId(
    phoneNumberId: string,
  ): Promise<RepositoryDocument<Tenant> | null> {
    const cached = this.phoneNumberCache.get(phoneNumberId);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const snapshot = await this.db
      .collection("tenants")
      .where("whatsapp.phoneNumberId", "==", phoneNumberId)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];

    if (!doc) {
      this.phoneNumberCache.set(phoneNumberId, { data: null, expiresAt: now + this.cacheTtlMs });
      return null;
    }

    const data = { id: doc.id, data: doc.data() as Tenant };
    this.phoneNumberCache.set(phoneNumberId, { data, expiresAt: now + this.cacheTtlMs });
    return data;
  }
}
