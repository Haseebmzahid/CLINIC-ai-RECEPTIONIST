import { randomUUID } from "node:crypto";

import { CreateServiceDtoSchema, UpdateServiceDtoSchema } from "@clinic-ai/shared";
import type { Request, Response } from "express";

import type { DomainServicesProvider } from "../services";
import { withId } from "../utils";
import { requireRequestTenantId } from "./controller-utils";

export function createServiceController(getServices: DomainServicesProvider) {
  return {
    list: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const services = await getServices().clinicServices.list(tenantId);

      response.status(200).json(services.map((service) => withId(service.id, service.data)));
    },

    create: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const body = CreateServiceDtoSchema.parse(request.body);
      const created = await getServices().clinicServices.create(
        tenantId,
        `svc_${randomUUID()}`,
        body,
      );
      await getServices().auditLogs.recordStaffMutation(tenantId, request.ctx, {
        action: "service.create",
        target: `services/${created.id}`,
      });

      response.status(201).json(withId(created.id, created.data));
    },

    update: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const body = UpdateServiceDtoSchema.parse(request.body);
      const updated = await getServices().clinicServices.update(
        tenantId,
        request.params.id ?? "",
        body,
      );
      await getServices().auditLogs.recordStaffMutation(tenantId, request.ctx, {
        action: "service.update",
        target: `services/${updated.id}`,
      });

      response.status(200).json(withId(updated.id, updated.data));
    },
  };
}
