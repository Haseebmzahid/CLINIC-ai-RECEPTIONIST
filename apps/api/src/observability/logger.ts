import pino from "pino";

export type LogFields = Record<string, unknown>;

const redactPaths = [
  "authorization",
  "accessToken",
  "accessTokenRef",
  "apiKey",
  "body",
  "headers.authorization",
  "password",
  "privateKey",
  "secret",
  "token",
  "*.authorization",
  "*.accessToken",
  "*.password",
  "*.secret",
  "*.token",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
});

export function logInfo(message: string, fields: LogFields = {}): void {
  logger.info(fields, message);
}

export function logWarn(message: string, fields: LogFields = {}): void {
  logger.warn(fields, message);
}

export function logError(message: string, fields: LogFields = {}): void {
  logger.error(fields, message);
}

export const structuredWorkerLogger = {
  info(message: string, fields: LogFields = {}): void {
    logInfo(message, fields);
  },
  warn(message: string, fields: LogFields = {}): void {
    logWarn(message, fields);
  },
  error(message: string, fields: LogFields = {}): void {
    logError(message, fields);
  },
};
