import type { Conversation } from "@clinic-ai/shared";
import type { Firestore } from "firebase-admin/firestore";

import {
  postProcessAssistantReply,
  evaluateInboundGuardrails,
  type ToolExecutionRecord,
} from "./guardrails";
import { buildSystemPrompt } from "./prompts";
import { aiToolDefinitions, createAiToolHandlers } from "./tools";
import type { AiChatMessage, AiClient } from "../integrations/openai";
import {
  ConversationRepository,
  FaqRepository,
  ServiceRepository,
  SettingsRepository,
  TenantRepository,
  type RepositoryDocument,
} from "../repositories";
import { logError, logInfo, metrics } from "../observability";
import type { DomainServices } from "../services";
import { AppError } from "../utils";

const DEFAULT_CONTEXT_WINDOW = 12;
const MAX_TOOL_ITERATIONS = 6;

const allowedTransitions: Record<Conversation["state"], Array<Conversation["state"]>> = {
  new: ["greeting", "browsing", "collecting", "scheduling", "handoff", "closed"],
  greeting: ["browsing", "collecting", "scheduling", "handoff", "closed"],
  browsing: ["browsing", "collecting", "scheduling", "handoff", "closed"],
  faq: ["browsing", "collecting", "scheduling", "handoff", "closed"],
  collecting: ["collecting", "scheduling", "handoff", "closed"],
  collecting_info: ["collecting", "scheduling", "handoff", "closed"],
  scheduling: ["scheduling", "booked", "handoff", "closed"],
  confirming: ["scheduling", "booked", "handoff", "closed"],
  confirmed: ["booked", "closed"],
  booked: ["closed", "handoff"],
  handoff: ["handoff", "closed"],
  closed: ["closed"],
};

export interface AiOrchestratorOptions {
  client: AiClient;
  services: DomainServices;
  db: Firestore;
  model?: string;
  contextWindow?: number;
  today?: Date;
}

export interface RunAiTurnInput {
  tenantId: string;
  conversationId: string;
  patientText: string;
}

export interface RunAiTurnResult {
  reply: string;
  state: Conversation["state"];
  needsHuman: boolean;
  aiPaused: boolean;
}

function messageRoleFromAuthor(author: string, direction: string): AiChatMessage["role"] {
  if (author === "patient" || direction === "in") {
    return "user";
  }

  return "assistant";
}

function applyTransition(
  currentState: Conversation["state"],
  proposedState: Conversation["state"] | undefined,
): Conversation["state"] {
  if (!proposedState || proposedState === currentState) {
    return currentState;
  }

  if (allowedTransitions[currentState]?.includes(proposedState)) {
    return proposedState;
  }

  return currentState;
}

function summarizeOlderTurns(existingSummary: string, olderMessages: AiChatMessage[]): string {
  if (olderMessages.length === 0) {
    return existingSummary;
  }

  const addition = olderMessages
    .map((message) => `${message.role}: ${message.content}`)
    .join(" | ")
    .slice(0, 1200);

  return [existingSummary, addition].filter(Boolean).join(" | ");
}

export class AiOrchestrator {
  private readonly conversations: ConversationRepository;
  private readonly tenants: TenantRepository;
  private readonly settings: SettingsRepository;
  private readonly servicesRepository: ServiceRepository;
  private readonly faqs: FaqRepository;

  constructor(private readonly options: AiOrchestratorOptions) {
    this.conversations = new ConversationRepository(options.db);
    this.tenants = new TenantRepository(options.db);
    this.settings = new SettingsRepository(options.db);
    this.servicesRepository = new ServiceRepository(options.db);
    this.faqs = new FaqRepository(options.db);
  }

  async runTurn(input: RunAiTurnInput): Promise<RunAiTurnResult> {
    const startedAt = Date.now();
    const conversation = await this.conversations.getById(input.tenantId, input.conversationId);

    if (!conversation) {
      throw new AppError("NOT_FOUND", 404, "Conversation was not found.");
    }

    const guardrail = evaluateInboundGuardrails(input.patientText);

    if (guardrail.shouldShortCircuit) {
      const nextState = guardrail.aiPaused ? "handoff" : conversation.data.state;
      await this.conversations.update(input.tenantId, input.conversationId, {
        needsHuman: guardrail.needsHuman ?? conversation.data.needsHuman,
        aiPaused: guardrail.aiPaused ?? conversation.data.aiPaused,
        state: nextState,
      });

      return {
        reply: guardrail.reply ?? "I can help with clinic information or booking.",
        state: nextState,
        needsHuman: guardrail.needsHuman ?? conversation.data.needsHuman,
        aiPaused: guardrail.aiPaused ?? conversation.data.aiPaused,
      };
    }

    const [tenant, profile, services, faqs, persistedMessages] = await Promise.all([
      this.tenants.getById(input.tenantId),
      this.settings.getProfile(input.tenantId),
      this.servicesRepository.list(input.tenantId),
      this.faqs.list(input.tenantId),
      this.conversations.listMessages(input.tenantId, input.conversationId),
    ]);

    if (!tenant) {
      throw new AppError("NOT_FOUND", 404, "Tenant was not found.");
    }

    if (!profile) {
      throw new AppError("NOT_FOUND", 404, "Settings profile was not found.");
    }

    const contextWindow = this.options.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
    const chatHistory = persistedMessages.map<AiChatMessage>((message) => ({
      role: messageRoleFromAuthor(message.data.author, message.data.direction),
      content: message.data.text,
    }));
    const olderMessages = chatHistory.slice(0, Math.max(0, chatHistory.length - contextWindow));
    const recentMessages = chatHistory.slice(-contextWindow);
    const mutableConversation: RepositoryDocument<Conversation> = {
      id: conversation.id,
      data: {
        ...conversation.data,
        context: { ...conversation.data.context },
        summary: summarizeOlderTurns(conversation.data.summary, olderMessages),
      },
    };
    const messages: AiChatMessage[] = [
      {
        role: "system",
        content: buildSystemPrompt({
          clinicName: tenant.data.name,
          profile: profile.data,
          services,
          faqs,
          conversation: mutableConversation,
          today: this.options.today ?? new Date(),
        }),
      },
      ...(mutableConversation.data.summary
        ? [
            {
              role: "system" as const,
              content: `Running summary: ${mutableConversation.data.summary}`,
            },
          ]
        : []),
      ...recentMessages,
      { role: "user", content: input.patientText },
    ];
    const handlers = createAiToolHandlers({
      tenantId: input.tenantId,
      conversation: mutableConversation,
      services: this.options.services,
      createdBy: "ai_service",
    });
    const toolExecutions: ToolExecutionRecord[] = [];
    let finalReply = "";

    try {
      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
        const response = await this.options.client.createChatCompletion({
          model: this.options.model ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
          messages,
          tools: aiToolDefinitions,
          temperature: 0.3,
          maxTokens: 500,
        });
        const assistantMessage = response.message;

        messages.push(assistantMessage);

        if (!assistantMessage.toolCalls || assistantMessage.toolCalls.length === 0) {
          finalReply = assistantMessage.content;
          break;
        }

        for (const toolCall of assistantMessage.toolCalls) {
          const handler = handlers[toolCall.name];

          if (!handler) {
            throw new AppError("VALIDATION_ERROR", 400, `Unknown AI tool: ${toolCall.name}`);
          }

          const result = await handler(toolCall.argumentsJson);

          toolExecutions.push({ name: toolCall.name, ok: result.ok });
          mutableConversation.data.context = {
            ...mutableConversation.data.context,
            ...(result.contextPatch ?? {}),
          };
          mutableConversation.data.state = applyTransition(
            mutableConversation.data.state,
            result.state,
          );
          mutableConversation.data.needsHuman =
            result.needsHuman ?? mutableConversation.data.needsHuman;
          mutableConversation.data.aiPaused = result.aiPaused ?? mutableConversation.data.aiPaused;

          messages.push({
            role: "tool",
            toolCallId: toolCall.id,
            name: toolCall.name,
            content: JSON.stringify(result.content),
          });
        }
      }
    } catch (error) {
      metrics.incrementAiError();
      logError("ai.turn", {
        conversationId: input.conversationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
        latencyMs: Date.now() - startedAt,
        tenantId: input.tenantId,
      });
      throw error;
    }

    if (!finalReply) {
      finalReply = "I'm sorry, I couldn't finish that. I'll have the clinic team help.";
      mutableConversation.data.needsHuman = true;
    }

    const safeReply = postProcessAssistantReply(finalReply, toolExecutions);

    await this.conversations.update(input.tenantId, input.conversationId, {
      state: mutableConversation.data.state,
      context: mutableConversation.data.context,
      summary: mutableConversation.data.summary,
      needsHuman: mutableConversation.data.needsHuman,
      aiPaused: mutableConversation.data.aiPaused,
    });
    logInfo("ai.turn", {
      conversationId: input.conversationId,
      latencyMs: Date.now() - startedAt,
      state: mutableConversation.data.state,
      tenantId: input.tenantId,
      toolCalls: toolExecutions.map((tool) => tool.name),
      tokens: null,
    });

    return {
      reply: safeReply,
      state: mutableConversation.data.state,
      needsHuman: mutableConversation.data.needsHuman,
      aiPaused: mutableConversation.data.aiPaused,
    };
  }
}
