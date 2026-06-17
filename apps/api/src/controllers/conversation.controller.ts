import {
  ConversationListQuerySchema,
  CreateConversationMessageDtoSchema,
  UpdateConversationDtoSchema,
} from "@clinic-ai/shared";
import type { Request, Response } from "express";

import type { DomainServicesProvider } from "../services";
import { toJsonValue } from "../utils";
import { requireRequestTenantId } from "./controller-utils";

export function createConversationController(getServices: DomainServicesProvider) {
  return {
    list: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const query = ConversationListQuerySchema.parse(request.query);
      const conversations = await getServices().conversations.listSummaries(
        tenantId,
        query.state,
        query.limit,
      );

      response.status(200).json(toJsonValue(conversations));
    },

    messages: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const messages = await getServices().conversations.listMessages(
        tenantId,
        request.params.id ?? "",
      );

      response.status(200).json(toJsonValue(messages));
    },

    sendMessage: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const body = CreateConversationMessageDtoSchema.parse(request.body);
      const result = await getServices().conversations.sendStaffConversationText(
        tenantId,
        request.params.id ?? "",
        body.text,
      );
      await getServices().auditLogs.recordStaffMutation(tenantId, request.ctx, {
        action: "conversation.message.create",
        target: `conversations/${request.params.id ?? ""}/messages/${result.messageId}`,
      });

      response.status(201).json(result);
    },

    update: async (request: Request, response: Response): Promise<void> => {
      const tenantId = requireRequestTenantId(request);
      const body = UpdateConversationDtoSchema.parse(request.body);
      const conversation = await getServices().conversations.updateAiPaused(
        tenantId,
        request.params.id ?? "",
        body.aiPaused,
      );
      await getServices().auditLogs.recordStaffMutation(tenantId, request.ctx, {
        action: "conversation.update",
        target: `conversations/${request.params.id ?? ""}`,
        meta: { aiPaused: body.aiPaused },
      });

      response.status(200).json(toJsonValue(conversation));
    },
  };
}
