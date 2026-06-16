import { Router } from "express";

import { createFaqController } from "../controllers/faq.controller";
import {
  asyncHandler,
  requireAuth,
  requireRole,
  requireTenantContext,
  type TokenVerifier,
} from "../middleware";
import type { DomainServicesProvider } from "../services";

export function createFaqRouter(
  getServices: DomainServicesProvider,
  verifier?: TokenVerifier,
): Router {
  const router = Router();
  const controller = createFaqController(getServices);

  router.use(requireAuth(verifier), requireTenantContext, requireRole("owner", "staff"));
  router.get("/", asyncHandler(controller.list));
  router.post("/", asyncHandler(controller.create));
  router.patch("/:id", asyncHandler(controller.update));
  router.delete("/:id", asyncHandler(controller.delete));

  return router;
}
