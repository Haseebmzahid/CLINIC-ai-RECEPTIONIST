import { ZodError } from "zod";

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "SLOT_TAKEN"
  | "RATE_LIMITED"
  | "UPSTREAM_AI_ERROR"
  | "UPSTREAM_WA_ERROR"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly httpStatus: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "That time was just booked. Here are other options.") {
    super("SLOT_TAKEN", 409, message);
    this.name = "ConflictError";
  }
}

export function validationErrorFromZod(error: ZodError): AppError {
  return new AppError("VALIDATION_ERROR", 400, "Invalid request.", {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}
