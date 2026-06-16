import request from "supertest";
import { describe, expect, it } from "vitest";

import { createServer } from "../src/server";

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const response = await request(createServer()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
