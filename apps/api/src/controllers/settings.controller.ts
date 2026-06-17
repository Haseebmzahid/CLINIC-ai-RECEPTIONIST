import { UpsertSettingsDtoSchema } from "@clinic-ai/shared";
import type { Request, Response } from "express";

import type { DomainServicesProvider } from "../services";
import { toJsonValue } from "../utils";
import { requireRequestTenantId } from "./controller-utils";

export function createSettingsController(getServices: DomainServicesProvider) {
  return {
    get: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const profile = await getServices().settings.getProfile(tenantId);

      response.status(200).json(toJsonValue(profile.data));
    },

    put: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const body = UpsertSettingsDtoSchema.parse(request.body);
      const profile = await getServices().settings.setProfile(tenantId, body);
      await getServices().auditLogs.recordStaffMutation(tenantId, request.ctx, {
        action: "settings.profile.upsert",
        target: "settings/profile",
      });

      response.status(200).json(toJsonValue(profile.data));
    },
  };
}
