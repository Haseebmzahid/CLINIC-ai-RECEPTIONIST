import { randomUUID } from "node:crypto";

import { CreateFaqDtoSchema, UpdateFaqDtoSchema } from "@clinic-ai/shared";
import type { Request, Response } from "express";

import type { DomainServicesProvider } from "../services";
import { withId } from "../utils";
import { requireRequestTenantId } from "./controller-utils";

export function createFaqController(getServices: DomainServicesProvider) {
  return {
    list: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const faqs = await getServices().faqs.list(tenantId);

      response.status(200).json(faqs.map((faq) => withId(faq.id, faq.data)));
    },

    create: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const body = CreateFaqDtoSchema.parse(request.body);
      const created = await getServices().faqs.create(tenantId, `faq_${randomUUID()}`, body);

      response.status(201).json(withId(created.id, created.data));
    },

    update: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const body = UpdateFaqDtoSchema.parse(request.body);
      const updated = await getServices().faqs.update(tenantId, request.params.id ?? "", body);

      response.status(200).json(withId(updated.id, updated.data));
    },

    delete: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);

      await getServices().faqs.delete(tenantId, request.params.id ?? "");
      response.status(204).send();
    },
  };
}
