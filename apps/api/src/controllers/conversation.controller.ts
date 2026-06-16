import type { Request, Response } from "express";

import type { DomainServicesProvider } from "../services";
import { toJsonValue } from "../utils";
import { requireRequestTenantId } from "./controller-utils";

export function createConversationController(getServices: DomainServicesProvider) {
  return {
    list: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const conversations = await getServices().conversations.listSummaries(tenantId);

      response.status(200).json(toJsonValue(conversations));
    },
  };
}
