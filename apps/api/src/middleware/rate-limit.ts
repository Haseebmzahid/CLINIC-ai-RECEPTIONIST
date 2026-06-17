import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils";

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  key: (request: Request) => string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export function createRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now();
    const bucketKey = key(request);
    const existing = buckets.get(bucketKey);
    const bucket =
      existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(bucketKey, bucket);

    response.setHeader("X-RateLimit-Limit", String(limit));
    response.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    response.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > limit) {
      const retryAfter = retryAfterSeconds(bucket.resetAt);

      response.setHeader("Retry-After", String(retryAfter));
      next(
        new AppError("RATE_LIMITED", 429, `Too many requests. Retry after ${retryAfter} seconds.`, {
          retryAfterSeconds: retryAfter,
        }),
      );
      return;
    }

    next();
  };
}

export function clearRateLimitBucketsForTests(): void {
  buckets.clear();
}

export const publicRateLimit = createRateLimit({
  windowMs: Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? "60000"),
  limit: Number(process.env.PUBLIC_RATE_LIMIT_MAX ?? "120"),
  key: (request) => `ip:${request.ip}:${request.path}`,
});

export const tenantRateLimit = createRateLimit({
  windowMs: Number(process.env.TENANT_RATE_LIMIT_WINDOW_MS ?? "60000"),
  limit: Number(process.env.TENANT_RATE_LIMIT_MAX ?? "300"),
  key: (request) =>
    `tenant:${request.ctx?.tenantId ?? request.auth?.tenantId ?? "unknown"}:${request.path}`,
});
