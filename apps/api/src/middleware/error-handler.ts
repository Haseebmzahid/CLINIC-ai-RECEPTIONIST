import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { captureException } from "../observability";
import { AppError, validationErrorFromZod } from "../utils";

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void next;

  const appError =
    error instanceof AppError
      ? error
      : error instanceof ZodError
        ? validationErrorFromZod(error)
        : new AppError("INTERNAL", 500, "Unexpected server error.");

  if (appError.httpStatus >= 500) {
    captureException(error, {
      code: appError.code,
      requestId: request.requestId,
      tenantId: request.ctx?.tenantId ?? request.auth?.tenantId,
    });
    request.log.error("Unhandled request error", {
      code: appError.code,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }

  response.status(appError.httpStatus).json({
    error: {
      code: appError.code,
      message: appError.message,
      requestId: request.requestId,
      ...(appError.details === undefined ? {} : { details: appError.details }),
    },
  });
}
