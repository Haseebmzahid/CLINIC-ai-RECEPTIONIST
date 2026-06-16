import express from "express";
import helmet from "helmet";

import { errorHandler, requestContext, type TokenVerifier } from "./middleware";
import { createLazyDomainServicesProvider } from "./services";
import { createFaqRouter } from "./routes/faq.route";
import { healthRouter } from "./routes/health.route";
import { createMeRouter } from "./routes/me.route";
import { createPatientRouter } from "./routes/patient.route";
import { createServiceRouter } from "./routes/service.route";
import { createSettingsRouter } from "./routes/settings.route";

export interface ServerOptions {
  tokenVerifier?: TokenVerifier;
}

export function createServer(options: ServerOptions = {}) {
  const app = express();
  const getServices = createLazyDomainServicesProvider();

  app.use(requestContext);
  app.use(helmet());
  app.use(express.json());
  app.use("/api/health", healthRouter);
  app.use("/api/me", createMeRouter(options.tokenVerifier));
  app.use("/api/services", createServiceRouter(getServices, options.tokenVerifier));
  app.use("/api/settings", createSettingsRouter(getServices, options.tokenVerifier));
  app.use("/api/faqs", createFaqRouter(getServices, options.tokenVerifier));
  app.use("/api/patients", createPatientRouter(getServices, options.tokenVerifier));
  app.use(errorHandler);

  return app;
}
