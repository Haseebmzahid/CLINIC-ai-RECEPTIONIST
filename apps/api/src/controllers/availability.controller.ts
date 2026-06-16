import { AvailabilityQuerySchema } from "@clinic-ai/shared";
import type { Request, Response } from "express";

import type { DomainServicesProvider } from "../services";
import { requireRequestTenantId } from "./controller-utils";

export function createAvailabilityController(getServices: DomainServicesProvider) {
  return {
    list: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const query = AvailabilityQuerySchema.parse(request.query);
      const slots = await getServices().availability.getAvailability(tenantId, query);

      response.status(200).json(slots);
    },
  };
}
