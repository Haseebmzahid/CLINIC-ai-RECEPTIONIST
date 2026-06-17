import { Router } from "express";

import { createFaqController } from "../controllers/faq.controller";
import {
  asyncHandler,
  requireAuth,
  requireRole,
  requireTenantContext,
  tenantRateLimit,
  type TokenVerifier,
} from "../middleware";
import type { DomainServicesProvider } from "../services";

export function createFaqRouter(
  getServices: DomainServicesProvider,
  verifier?: TokenVerifier,
): Router {
  const router = Router();
  const controller = createFaqController(getServices);

  router.use(requireAuth(verifier), requireTenantContext, tenantRateLimit);
  router.get("/", requireRole("owner", "staff"), asyncHandler(controller.list));
  router.post("/", requireRole("owner"), asyncHandler(controller.create));
  router.patch("/:id", requireRole("owner"), asyncHandler(controller.update));
  router.delete("/:id", requireRole("owner"), asyncHandler(controller.delete));

  return router;
}
