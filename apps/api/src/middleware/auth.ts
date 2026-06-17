import type { DecodedIdToken } from "firebase-admin/auth";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { getAdminAuth } from "../integrations/firebase";
import { AppError } from "../utils";

const ClaimsSchema = z.object({
  uid: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  role: z.enum(["owner", "staff", "platform_admin", "ai_service"]),
});

export interface TokenVerifier {
  verifyIdToken(token: string): Promise<DecodedIdToken | Record<string, unknown>>;
}

function extractBearerToken(request: Request): string {
  const authorization = request.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHENTICATED", 401, "Missing bearer token.");
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new AppError("UNAUTHENTICATED", 401, "Missing bearer token.");
  }

  return token;
}

export function requireAuth(verifier?: TokenVerifier) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    void (async () => {
      try {
        const token = extractBearerToken(request);
        const activeVerifier = verifier ?? getAdminAuth();
        const decoded = await activeVerifier.verifyIdToken(token);
        const claims = ClaimsSchema.parse(decoded);

        request.auth = {
          uid: claims.uid,
          role: claims.role,
          tenantId: claims.tenantId,
        };

        next();
      } catch (error) {
        if (error instanceof AppError) {
          request.log.warn("auth.denied", { reason: error.code });
          next(error);
          return;
        }

        request.log.warn("auth.denied", { reason: "invalid_token" });
        next(new AppError("UNAUTHENTICATED", 401, "Invalid bearer token."));
      }
    })();
  };
}
