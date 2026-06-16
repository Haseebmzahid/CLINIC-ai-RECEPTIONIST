import { describe, expect, it } from "vitest";

import { HealthStatusSchema } from "../src/index";

describe("HealthStatusSchema", () => {
  it("accepts the placeholder health response", () => {
    expect(HealthStatusSchema.parse({ status: "ok" })).toEqual({ status: "ok" });
  });
});
