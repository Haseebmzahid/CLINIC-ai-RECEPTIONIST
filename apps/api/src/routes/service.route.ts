import { Router } from "express";

import { createServiceController } from "../controllers/service.controller";
import {
  asyncHandler,
  requireAuth,
  requireRole,
  requireTenantContext,
  type TokenVerifier,
} from "../middleware";
import type { DomainServicesProvider } from "../services";

export function createServiceRouter(
  getServices: DomainServicesProvider,
  verifier?: TokenVerifier,
): Router {
  const router = Router();
  const controller = createServiceController(getServices);

  router.use(requireAuth(verifier), requireTenantContext);
  router.get("/", requireRole("owner", "staff"), asyncHandler(controller.list));
  router.post("/", requireRole("owner"), asyncHandler(controller.create));
  router.patch("/:id", requireRole("owner"), asyncHandler(controller.update));

  return router;
}
