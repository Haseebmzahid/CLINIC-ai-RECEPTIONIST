import type { SettingsProfile } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";

import type { RepositoryDocument, RepositoryUpdate } from "./base.repository";

export class SettingsRepository {
  private readonly profileCache = new Map<
    string,
    { data: RepositoryDocument<SettingsProfile> | null; expiresAt: number }
  >();
  private readonly cacheTtlMs = Number(process.env.SETTINGS_CACHE_TTL_MS ?? "30000");

  constructor(private readonly db: Firestore) {}

  async setProfile(
    tenantId: string,
    data: SettingsProfile,
  ): Promise<RepositoryDocument<SettingsProfile>> {
    await this.db.collection(`tenants/${tenantId}/settings`).doc("profile").set(data);
    this.profileCache.set(tenantId, {
      data: { id: "profile", data },
      expiresAt: Date.now() + this.cacheTtlMs,
    });
    return { id: "profile", data };
  }

  async getProfile(tenantId: string): Promise<RepositoryDocument<SettingsProfile> | null> {
    const cached = this.profileCache.get(tenantId);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const snapshot = await this.db.collection(`tenants/${tenantId}/settings`).doc("profile").get();

    if (!snapshot.exists) {
      this.profileCache.set(tenantId, { data: null, expiresAt: now + this.cacheTtlMs });
      return null;
    }

    const data = { id: snapshot.id, data: snapshot.data() as SettingsProfile };
    this.profileCache.set(tenantId, { data, expiresAt: now + this.cacheTtlMs });
    return data;
  }

  async updateProfile(tenantId: string, data: RepositoryUpdate<SettingsProfile>): Promise<void> {
    await this.db.collection(`tenants/${tenantId}/settings`).doc("profile").update(data);
    this.profileCache.delete(tenantId);
  }
}
