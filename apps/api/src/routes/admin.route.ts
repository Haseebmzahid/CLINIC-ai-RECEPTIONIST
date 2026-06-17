import { Router } from "express";

import { createAdminController } from "../controllers/admin.controller";
import {
  asyncHandler,
  requireAuth,
  requireRole,
  requireTenantContext,
  tenantRateLimit,
  type TokenVerifier,
} from "../middleware";
import type { DomainServicesProvider } from "../services";

export function createAdminRouter(
  getServices: DomainServicesProvider,
  verifier?: TokenVerifier,
): Router {
  const router = Router();
  const controller = createAdminController(getServices);

  router.use(
    requireAuth(verifier),
    requireTenantContext,
    tenantRateLimit,
    requireRole("platform_admin"),
  );
  router.post("/tenants", asyncHandler(controller.createTenant));
  router.patch("/tenants/:id", asyncHandler(controller.updateTenant));
  router.get("/health", asyncHandler(controller.health));

  return router;
}
