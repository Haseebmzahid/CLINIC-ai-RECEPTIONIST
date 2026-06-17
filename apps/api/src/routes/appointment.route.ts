import { Router } from "express";

import { createAppointmentController } from "../controllers/appointment.controller";
import {
  asyncHandler,
  requireAuth,
  requireRole,
  requireTenantContext,
  tenantRateLimit,
  type TokenVerifier,
} from "../middleware";
import type { DomainServicesProvider } from "../services";

export function createAppointmentRouter(
  getServices: DomainServicesProvider,
  verifier?: TokenVerifier,
): Router {
  const router = Router();
  const controller = createAppointmentController(getServices);

  router.use(
    requireAuth(verifier),
    requireTenantContext,
    tenantRateLimit,
    requireRole("owner", "staff"),
  );
  router.get("/", asyncHandler(controller.list));
  router.post("/", asyncHandler(controller.create));
  router.patch("/:id", asyncHandler(controller.update));
  router.delete("/:id", asyncHandler(controller.delete));

  return router;
}
