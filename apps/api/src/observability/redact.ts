import { createHash } from "node:crypto";

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function hashOptional(value: string | undefined): string | undefined {
  return value ? hashIdentifier(value) : undefined;
}
