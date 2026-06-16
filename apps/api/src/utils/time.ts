import { AppError } from "./errors";

export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const zonedFormatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = zonedFormatters.get(timezone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  zonedFormatters.set(timezone, formatter);
  return formatter;
}

export function getZonedParts(date: Date, timezone: string): ZonedDateTimeParts {
  const parts = Object.fromEntries(
    getFormatter(timezone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

function partsAsUtcMs(parts: ZonedDateTimeParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

export function zonedTimeToUtc(localDate: string, localTime: string, timezone: string): Date {
  const [year = 0, month = 1, day = 1] = localDate.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = localTime.split(":").map(Number);
  const targetParts = { year, month, day, hour, minute, second };
  const targetMs = partsAsUtcMs(targetParts);
  let utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  for (let index = 0; index < 3; index += 1) {
    const actualMs = partsAsUtcMs(getZonedParts(utcDate, timezone));
    utcDate = new Date(utcDate.getTime() + targetMs - actualMs);
  }

  return utcDate;
}

export function getLocalDateString(date: Date, timezone: string): string {
  const parts = getZonedParts(date, timezone);
  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

export function addLocalDays(localDate: string, days: number): string {
  const [year = 0, month = 1, day = 1] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

export function getLocalDayOfWeek(localDate: string, timezone: string): number {
  void timezone;
  const [year = 0, month = 1, day = 1] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function parseRangeBoundary(value: string, timezone: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return zonedTimeToUtc(value, "00:00:00", timezone);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError("VALIDATION_ERROR", 400, "Invalid date boundary.");
  }

  return date;
}
