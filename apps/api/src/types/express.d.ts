import type { UserRoleSchema } from "@clinic-ai/shared";
import type { z } from "zod";

export type AuthenticatedRole = z.infer<typeof UserRoleSchema>;

export interface RequestLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export interface VerifiedAuthClaims {
  uid: string;
  role: AuthenticatedRole;
  tenantId?: string;
}

export interface RequestContext {
  uid: string;
  role: AuthenticatedRole;
  tenantId?: string;
  requestId: string;
}

export interface AuthDebugContext {
  tokenLength: number;
  tokenPreview: string;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: RequestLogger;
      rawBody?: Buffer;
      auth?: VerifiedAuthClaims;
      authDebug?: AuthDebugContext;
      ctx?: RequestContext;
    }
  }
}

export {};
