import { Router, type Router as ExpressRouter } from "express";

import {
  getHealth,
  getMetrics,
  getReadiness,
  getSentryTest,
} from "../controllers/health.controller";

export const healthRouter: ExpressRouter = Router();

healthRouter.get("/", getHealth);
healthRouter.get("/ready", getReadiness);
healthRouter.get("/metrics", getMetrics);
healthRouter.get("/sentry-test", getSentryTest);
