import { z } from "zod";

const ApiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});

export const MeSchema = z.object({
  uid: z.string(),
  role: z.enum(["owner", "staff", "platform_admin", "ai_service"]),
  tenantId: z.string().optional(),
  requestId: z.string(),
});

export type Me = z.infer<typeof MeSchema>;

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export interface ApiClientOptions {
  getIdToken: () => Promise<string>;
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async getMe(): Promise<Me> {
    return this.request("/api/me", MeSchema);
  }

  private async request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const token = await this.options.getIdToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    const payload = (await response.json()) as unknown;

    if (!response.ok) {
      const parsed = ApiErrorEnvelopeSchema.safeParse(payload);

      if (parsed.success) {
        throw new ApiClientError(
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.requestId,
          parsed.data.error.details,
        );
      }

      throw new ApiClientError("HTTP_ERROR", "The API request failed.");
    }

    return schema.parse(payload);
  }
}
