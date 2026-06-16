import { z } from "zod";

import type { AiToolDefinition } from "../integrations/openai";
import type { RepositoryDocument } from "../repositories";
import type { DomainServices } from "../services";
import { AppError } from "../utils";
import type { Conversation } from "@clinic-ai/shared";

const JsonSchemaString = { type: "string" } as const;

export const aiToolDefinitions: AiToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_availability",
      description: "Get available appointment slots for a service within an ISO date range.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          serviceId: JsonSchemaString,
          fromISO: JsonSchemaString,
          toISO: JsonSchemaString,
        },
        required: ["serviceId", "fromISO", "toISO"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Book an appointment using a previously returned slotId.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          slotId: JsonSchemaString,
          serviceId: JsonSchemaString,
          patientName: JsonSchemaString,
        },
        required: ["slotId", "serviceId", "patientName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Cancel an existing appointment by id.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          appointmentId: JsonSchemaString,
        },
        required: ["appointmentId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "answer_faq",
      description: "Answer a clinic FAQ from tenant-owned FAQ data.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: JsonSchemaString,
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "handoff_to_human",
      description: "Escalate the conversation to clinic staff and pause AI.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          reason: JsonSchemaString,
        },
        required: ["reason"],
      },
    },
  },
];

const GetAvailabilityArgsSchema = z.object({
  serviceId: z.string().min(1),
  fromISO: z.string().min(1),
  toISO: z.string().min(1),
});

const BookAppointmentArgsSchema = z.object({
  slotId: z.string().min(1),
  serviceId: z.string().min(1),
  patientName: z.string().min(1),
});

const CancelAppointmentArgsSchema = z.object({
  appointmentId: z.string().min(1),
});

const AnswerFaqArgsSchema = z.object({
  query: z.string().min(1),
});

const HandoffArgsSchema = z.object({
  reason: z.string().min(1),
});

export interface AiToolResult {
  ok: boolean;
  content: Record<string, unknown>;
  contextPatch?: Record<string, unknown>;
  state?: Conversation["state"];
  needsHuman?: boolean;
  aiPaused?: boolean;
}

export interface AiToolHandlerContext {
  tenantId: string;
  conversation: RepositoryDocument<Conversation>;
  services: DomainServices;
  createdBy: string;
}

type ToolHandler = (argsJson: string) => Promise<AiToolResult>;

function parseArgs<T>(schema: z.ZodType<T>, argsJson: string): T {
  return schema.parse(JSON.parse(argsJson) as unknown);
}

function availableSlotsFromContext(conversation: RepositoryDocument<Conversation>): Array<{
  slotId: string;
  serviceId: string;
  startsAt: string;
}> {
  const value = conversation.data.context.availableSlots;

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isAvailableSlotContextValue);
}

function isAvailableSlotContextValue(
  slot: unknown,
): slot is { slotId: string; serviceId: string; startsAt: string } {
  if (typeof slot !== "object" || slot === null) {
    return false;
  }

  const candidate = slot as Record<string, unknown>;
  return (
    typeof candidate.slotId === "string" &&
    typeof candidate.serviceId === "string" &&
    typeof candidate.startsAt === "string"
  );
}

export function createAiToolHandlers(context: AiToolHandlerContext): Record<string, ToolHandler> {
  return {
    get_availability: async (argsJson) => {
      const args = parseArgs(GetAvailabilityArgsSchema, argsJson);
      const slots = await context.services.availability.getAvailability(context.tenantId, {
        serviceId: args.serviceId,
        from: args.fromISO,
        to: args.toISO,
      });

      return {
        ok: true,
        content: {
          slots: slots.map((slot) => ({
            slotId: slot.slotId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
          })),
        },
        contextPatch: {
          serviceId: args.serviceId,
          availableSlots: slots,
        },
        state: "scheduling",
      };
    },

    book_appointment: async (argsJson) => {
      const args = parseArgs(BookAppointmentArgsSchema, argsJson);
      const slot = availableSlotsFromContext(context.conversation).find(
        (candidate) => candidate.slotId === args.slotId && candidate.serviceId === args.serviceId,
      );

      if (!slot) {
        return {
          ok: false,
          content: { ok: false, error: "UNKNOWN_SLOT" },
          state: "scheduling",
        };
      }

      try {
        const appointment = await context.services.appointments.create(
          context.tenantId,
          `appt_ai_${args.slotId}`,
          {
            patientId: context.conversation.data.patientId,
            serviceId: args.serviceId,
            startsAt: slot.startsAt,
          },
          context.createdBy,
        );
        const confirmation = await context.services.conversations.sendBookingConfirmation(
          context.tenantId,
          context.conversation.id,
          appointment.id,
        );

        return {
          ok: true,
          content: {
            ok: true,
            appointmentId: appointment.id,
            confirmationStatus: confirmation.status,
          },
          contextPatch: {
            appointmentId: appointment.id,
            patientName: args.patientName,
            confirmationMessageId: confirmation.messageId,
          },
          state: "booked",
        };
      } catch (error) {
        if (error instanceof AppError && error.code === "SLOT_TAKEN") {
          return {
            ok: false,
            content: { ok: false, error: "SLOT_TAKEN" },
            state: "scheduling",
          };
        }

        throw error;
      }
    },

    cancel_appointment: async (argsJson) => {
      const args = parseArgs(CancelAppointmentArgsSchema, argsJson);
      await context.services.appointments.cancel(context.tenantId, args.appointmentId);
      return { ok: true, content: { ok: true } };
    },

    answer_faq: async (argsJson) => {
      const args = parseArgs(AnswerFaqArgsSchema, argsJson);
      const query = args.query.toLowerCase();
      const faqs = await context.services.faqs.list(context.tenantId);
      const match = faqs.find(
        (faq) =>
          faq.data.active &&
          (faq.data.question.toLowerCase().includes(query) ||
            faq.data.tags.some((tag) => query.includes(tag.toLowerCase()))),
      );

      return {
        ok: true,
        content: { answer: match?.data.answer ?? null },
        state: "browsing",
      };
    },

    handoff_to_human: (argsJson) => {
      const args = parseArgs(HandoffArgsSchema, argsJson);
      return Promise.resolve({
        ok: true,
        content: { ok: true },
        contextPatch: { handoffReason: args.reason },
        state: "handoff",
        needsHuman: true,
        aiPaused: true,
      });
    },
  };
}
