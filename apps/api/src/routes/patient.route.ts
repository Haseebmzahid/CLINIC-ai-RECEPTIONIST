import { Router } from "express";

import { createPatientController } from "../controllers/patient.controller";
import {
  asyncHandler,
  requireAuth,
  requireRole,
  requireTenantContext,
  tenantRateLimit,
  type TokenVerifier,
} from "../middleware";
import type { DomainServicesProvider } from "../services";

export function createPatientRouter(
  getServices: DomainServicesProvider,
  verifier?: TokenVerifier,
): Router {
  const router = Router();
  const controller = createPatientController(getServices);

  router.use(
    requireAuth(verifier),
    requireTenantContext,
    tenantRateLimit,
    requireRole("owner", "staff"),
  );
  router.get("/", asyncHandler(controller.search));
  router.get("/:id", asyncHandler(controller.getDetail));
  router.post("/", asyncHandler(controller.create));
  router.patch("/:id", asyncHandler(controller.update));

  return router;
}
