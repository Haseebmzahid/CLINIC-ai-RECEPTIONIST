import { CreateTenantDtoSchema, UpdateTenantDtoSchema } from "@clinic-ai/shared";
import type { Request, Response } from "express";

import { metrics } from "../observability";
import type { DomainServicesProvider } from "../services";
import { toJsonValue, withId } from "../utils";

export function createAdminController(getServices: DomainServicesProvider) {
  return {
    createTenant: async (request: Request, response: Response): Promise<void> => {
      const body = CreateTenantDtoSchema.parse(request.body);
      const tenant = await getServices().admin.createTenant(body);
      await getServices().auditLogs.recordStaffMutation(tenant.id, request.ctx, {
        action: "tenant.create",
        target: `tenants/${tenant.id}`,
      });

      response.status(201).json(toJsonValue(withId(tenant.id, tenant.data)));
    },

    updateTenant: async (request: Request, response: Response): Promise<void> => {
      const body = UpdateTenantDtoSchema.parse(request.body);
      const tenant = await getServices().admin.updateTenant(request.params.id ?? "", body);
      await getServices().auditLogs.recordStaffMutation(tenant.id, request.ctx, {
        action: "tenant.update",
        target: `tenants/${tenant.id}`,
      });

      response.status(200).json(toJsonValue(withId(tenant.id, tenant.data)));
    },

    health: (_request: Request, response: Response): void => {
      response.status(200).json({
        status: "ok",
        metrics: metrics.snapshot(),
      });
    },
  };
}
