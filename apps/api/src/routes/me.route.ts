import { Router } from "express";

import { getMe } from "../controllers/me.controller";
import {
  requireAuth,
  requireTenantContext,
  tenantRateLimit,
  type TokenVerifier,
} from "../middleware";

export function createMeRouter(verifier?: TokenVerifier): Router {
  const router = Router();

  router.get("/", requireAuth(verifier), requireTenantContext, tenantRateLimit, getMe);

  return router;
}
