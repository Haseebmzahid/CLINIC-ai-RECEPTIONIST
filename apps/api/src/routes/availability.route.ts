import { Router } from "express";

import { createAvailabilityController } from "../controllers/availability.controller";
import {
  asyncHandler,
  requireAuth,
  requireRole,
  requireTenantContext,
  type TokenVerifier,
} from "../middleware";
import type { DomainServicesProvider } from "../services";

export function createAvailabilityRouter(
  getServices: DomainServicesProvider,
  verifier?: TokenVerifier,
): Router {
  const router = Router();
  const controller = createAvailabilityController(getServices);

  router.use(requireAuth(verifier), requireTenantContext, requireRole("owner", "staff"));
  router.get("/", asyncHandler(controller.list));

  return router;
}
