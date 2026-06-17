import { Router } from "express";

import { createSettingsController } from "../controllers/settings.controller";
import {
  asyncHandler,
  requireAuth,
  requireRole,
  requireTenantContext,
  tenantRateLimit,
  type TokenVerifier,
} from "../middleware";
import type { DomainServicesProvider } from "../services";

export function createSettingsRouter(
  getServices: DomainServicesProvider,
  verifier?: TokenVerifier,
): Router {
  const router = Router();
  const controller = createSettingsController(getServices);

  router.use(requireAuth(verifier), requireTenantContext, tenantRateLimit);
  router.get("/", requireRole("owner", "staff"), asyncHandler(controller.get));
  router.put("/", requireRole("owner"), asyncHandler(controller.put));

  return router;
}
