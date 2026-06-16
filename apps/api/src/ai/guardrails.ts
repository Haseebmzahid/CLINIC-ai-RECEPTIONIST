export interface GuardrailDecision {
  shouldShortCircuit: boolean;
  reply?: string;
  needsHuman?: boolean;
  aiPaused?: boolean;
}

export interface ToolExecutionRecord {
  name: string;
  ok: boolean;
}

const medicalAdvicePattern =
  /\b(diagnos|symptom|pain|bleeding|dosage|medicine|medication|infection|swelling|fever|emergency|urgent|cure|treat)\b/i;
const humanHandoffPattern = /\b(human|person|staff|receptionist|agent|complaint|angry|manager)\b/i;
const promptDisclosurePattern =
  /\b(system prompt|tool definitions|developer message|instructions|ignore previous)\b/i;
const bookingClaimPattern = /\b(booked|confirmed|appointment is set|see you then)\b/i;

export function evaluateInboundGuardrails(patientText: string): GuardrailDecision {
  if (promptDisclosurePattern.test(patientText)) {
    return {
      shouldShortCircuit: true,
      reply: "I can't share internal instructions, but I can help with clinic info or booking.",
    };
  }

  if (medicalAdvicePattern.test(patientText)) {
    return {
      shouldShortCircuit: true,
      needsHuman: true,
      reply:
        "I'm not able to give medical advice, but I can book you with the clinician who can help. Shall I find a time?",
    };
  }

  if (humanHandoffPattern.test(patientText)) {
    return {
      shouldShortCircuit: true,
      needsHuman: true,
      aiPaused: true,
      reply: "I'll pass this to the clinic team so a person can help you.",
    };
  }

  return { shouldShortCircuit: false };
}

export function postProcessAssistantReply(
  reply: string,
  toolExecutions: ToolExecutionRecord[],
): string {
  const hasSuccessfulBooking = toolExecutions.some(
    (execution) => execution.name === "book_appointment" && execution.ok,
  );

  if (bookingClaimPattern.test(reply) && !hasSuccessfulBooking) {
    return "I need to confirm that with the booking system first. Please choose one of the available times.";
  }

  return reply;
}
