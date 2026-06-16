import type { Request, Response } from "express";

import { HealthStatusSchema } from "@clinic-ai/shared";

export function getHealth(_request: Request, response: Response) {
  const body = HealthStatusSchema.parse({ status: "ok" });

  response.status(200).json(body);
}
