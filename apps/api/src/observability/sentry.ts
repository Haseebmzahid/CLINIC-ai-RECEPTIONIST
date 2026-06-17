import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(): void {
  if (initialized) {
    return;
  }

  initialized = true;
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    release: process.env.APP_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
      }

      return event;
    },
  });
}

export function captureException(
  error: unknown,
  tags: Record<string, string | undefined> = {},
): string | undefined {
  initSentry();

  return Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(tags)) {
      if (value) {
        scope.setTag(key, value);
      }
    }

    return Sentry.captureException(error);
  });
}

export function captureMessage(
  message: string,
  tags: Record<string, string | undefined> = {},
): string | undefined {
  initSentry();

  return Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(tags)) {
      if (value) {
        scope.setTag(key, value);
      }
    }

    return Sentry.captureMessage(message);
  });
}
