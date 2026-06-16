import { Router } from "express";
import { z } from "zod";

import {
  parseWhatsAppInboundMessages,
  parseWhatsAppStatusEvents,
  verifyWhatsAppSignature,
} from "../integrations/whatsapp";
import type { InboundMessageQueue, WhatsAppStatusProcessor } from "../jobs";
import { asyncHandler } from "../middleware";
import { AppError } from "../utils";

const HandshakeQuerySchema = z.object({
  "hub.mode": z.string().optional(),
  "hub.verify_token": z.string().optional(),
  "hub.challenge": z.string().optional(),
});

export interface WhatsAppWebhookRouterOptions {
  getQueue: () => InboundMessageQueue;
  getStatusProcessor: () => WhatsAppStatusProcessor;
  verifyToken?: string;
  appSecret?: string;
}

export function createWhatsAppWebhookRouter(options: WhatsAppWebhookRouterOptions): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler((request, response) => {
      const query = HandshakeQuerySchema.parse(request.query);

      if (
        query["hub.mode"] === "subscribe" &&
        query["hub.verify_token"] &&
        query["hub.verify_token"] === options.verifyToken
      ) {
        response.status(200).send(query["hub.challenge"] ?? "");
        return;
      }

      throw new AppError("FORBIDDEN", 403, "Invalid WhatsApp verify token.");
    }),
  );

  router.post(
    "/",
    asyncHandler((request, response) => {
      verifyWhatsAppSignature(
        request.rawBody,
        request.header("x-hub-signature-256"),
        options.appSecret,
      );

      const events = parseWhatsAppInboundMessages(request.body);
      const statusEvents = parseWhatsAppStatusEvents(request.body);

      options.getQueue().enqueue(events);
      for (const event of statusEvents) {
        void options.getStatusProcessor().process(event);
      }
      response.status(200).json({ received: true });
    }),
  );

  return router;
}
