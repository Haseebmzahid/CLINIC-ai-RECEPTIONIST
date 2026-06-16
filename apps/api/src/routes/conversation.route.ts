import { Router } from "express";

import { createConversationController } from "../controllers/conversation.controller";
import {
  asyncHandler,
  requireAuth,
  requireRole,
  requireTenantContext,
  type TokenVerifier,
} from "../middleware";
import type { DomainServicesProvider } from "../services";

export function createConversationRouter(
  getServices: DomainServicesProvider,
  verifier?: TokenVerifier,
): Router {
  const router = Router();
  const controller = createConversationController(getServices);

  router.use(requireAuth(verifier), requireTenantContext, requireRole("owner", "staff"));
  router.get("/", asyncHandler(controller.list));

  return router;
}
