import type { SettingsProfile } from "@clinic-ai/shared";

import type { RepositoryDocument } from "../repositories";
import { SettingsRepository } from "../repositories";
import { AppError } from "../utils";

export class SettingsService {
  constructor(private readonly settings: SettingsRepository) {}

  async getProfile(tenantId: string): Promise<RepositoryDocument<SettingsProfile>> {
    const profile = await this.settings.getProfile(tenantId);

    if (!profile) {
      throw new AppError("NOT_FOUND", 404, "Settings profile was not found.");
    }

    return profile;
  }

  async setProfile(
    tenantId: string,
    profile: SettingsProfile,
  ): Promise<RepositoryDocument<SettingsProfile>> {
    return this.settings.setProfile(tenantId, profile);
  }
}
