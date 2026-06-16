import { AppError } from "../utils";

export interface AiToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export interface AiChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  name?: string;
  toolCalls?: AiToolCall[];
}

export interface AiToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiChatRequest {
  model: string;
  messages: AiChatMessage[];
  tools: AiToolDefinition[];
  temperature: number;
  maxTokens: number;
}

export interface AiChatResponse {
  message: AiChatMessage;
}

export interface AiClient {
  createChatCompletion(request: AiChatRequest): Promise<AiChatResponse>;
}

export class UnconfiguredOpenAiClient implements AiClient {
  createChatCompletion(): Promise<AiChatResponse> {
    return Promise.reject(
      new AppError(
        "UPSTREAM_AI_ERROR",
        502,
        "OpenAI client is not configured for this environment.",
      ),
    );
  }
}
