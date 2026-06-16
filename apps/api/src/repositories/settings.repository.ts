import type { SettingsProfile } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";

import type { RepositoryDocument, RepositoryUpdate } from "./base.repository";

export class SettingsRepository {
  constructor(private readonly db: Firestore) {}

  async setProfile(
    tenantId: string,
    data: SettingsProfile,
  ): Promise<RepositoryDocument<SettingsProfile>> {
    await this.db.collection(`tenants/${tenantId}/settings`).doc("profile").set(data);
    return { id: "profile", data };
  }

  async getProfile(tenantId: string): Promise<RepositoryDocument<SettingsProfile> | null> {
    const snapshot = await this.db.collection(`tenants/${tenantId}/settings`).doc("profile").get();

    if (!snapshot.exists) {
      return null;
    }

    return { id: snapshot.id, data: snapshot.data() as SettingsProfile };
  }

  async updateProfile(tenantId: string, data: RepositoryUpdate<SettingsProfile>): Promise<void> {
    await this.db.collection(`tenants/${tenantId}/settings`).doc("profile").update(data);
  }
}
