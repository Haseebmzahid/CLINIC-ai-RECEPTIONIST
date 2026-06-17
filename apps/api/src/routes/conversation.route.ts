import { Router } from "express";

import { createConversationController } from "../controllers/conversation.controller";
import {
  asyncHandler,
  requireAuth,
  requireRole,
  requireTenantContext,
  tenantRateLimit,
  type TokenVerifier,
} from "../middleware";
import type { DomainServicesProvider } from "../services";

export function createConversationRouter(
  getServices: DomainServicesProvider,
  verifier?: TokenVerifier,
): Router {
  const router = Router();
  const controller = createConversationController(getServices);

  router.use(
    requireAuth(verifier),
    requireTenantContext,
    tenantRateLimit,
    requireRole("owner", "staff"),
  );
  router.get("/", asyncHandler(controller.list));
  router.get("/:id/messages", asyncHandler(controller.messages));
  router.post("/:id/messages", asyncHandler(controller.sendMessage));
  router.patch("/:id", asyncHandler(controller.update));

  return router;
}
