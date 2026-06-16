import express from "express";
import helmet from "helmet";

import { getDb } from "./integrations/firebase";
import { InboundMessageProcessor, InboundMessageQueue } from "./jobs";
import { errorHandler, requestContext, type TokenVerifier } from "./middleware";
import { createLazyDomainServicesProvider } from "./services";
import { createAppointmentRouter } from "./routes/appointment.route";
import { createAvailabilityRouter } from "./routes/availability.route";
import { createFaqRouter } from "./routes/faq.route";
import { healthRouter } from "./routes/health.route";
import { createMeRouter } from "./routes/me.route";
import { createPatientRouter } from "./routes/patient.route";
import { createServiceRouter } from "./routes/service.route";
import { createSettingsRouter } from "./routes/settings.route";
import { createWhatsAppWebhookRouter } from "./routes/webhooks.whatsapp.route";

export interface ServerOptions {
  tokenVerifier?: TokenVerifier;
  whatsappQueue?: InboundMessageQueue;
  whatsappAppSecret?: string;
  whatsappVerifyToken?: string;
}

export function createServer(options: ServerOptions = {}) {
  const app = express();
  const getServices = createLazyDomainServicesProvider();
  let whatsappQueue = options.whatsappQueue;
  const getWhatsAppQueue = () => {
    whatsappQueue ??= new InboundMessageQueue(new InboundMessageProcessor(getDb()));
    return whatsappQueue;
  };

  app.use(requestContext);
  app.use(helmet());
  app.use(
    express.json({
      verify: (request, _response, buffer) => {
        (request as unknown as Express.Request).rawBody = Buffer.from(buffer);
      },
    }),
  );
  app.use("/api/health", healthRouter);
  app.use(
    "/api/webhooks/whatsapp",
    createWhatsAppWebhookRouter({
      getQueue: getWhatsAppQueue,
      appSecret: options.whatsappAppSecret ?? process.env.WHATSAPP_APP_SECRET,
      verifyToken: options.whatsappVerifyToken ?? process.env.WHATSAPP_VERIFY_TOKEN,
    }),
  );
  app.use("/api/me", createMeRouter(options.tokenVerifier));
  app.use("/api/availability", createAvailabilityRouter(getServices, options.tokenVerifier));
  app.use("/api/appointments", createAppointmentRouter(getServices, options.tokenVerifier));
  app.use("/api/services", createServiceRouter(getServices, options.tokenVerifier));
  app.use("/api/settings", createSettingsRouter(getServices, options.tokenVerifier));
  app.use("/api/faqs", createFaqRouter(getServices, options.tokenVerifier));
  app.use("/api/patients", createPatientRouter(getServices, options.tokenVerifier));
  app.use(errorHandler);

  return app;
}
