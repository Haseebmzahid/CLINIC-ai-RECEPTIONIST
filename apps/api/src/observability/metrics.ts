export interface MetricsSnapshot {
  aiErrorCount: number;
  appointmentConflictCount: number;
  http5xxCount: number;
  httpRequestCount: number;
  httpRequestLatencyMs: {
    count: number;
    max: number;
    p95: number;
  };
  tenantUsage: Record<string, { aiTurns: number; messages: number }>;
  webhookDlqCount: number;
  webhookQueueDepth: number;
  whatsappSendFailureCount: number;
}

const httpLatencies: number[] = [];
const tenantUsage = new Map<string, { aiTurns: number; messages: number }>();

let httpRequestCount = 0;
let http5xxCount = 0;
let webhookQueueDepth = 0;
let webhookDlqCount = 0;
let whatsappSendFailureCount = 0;
let aiErrorCount = 0;
let appointmentConflictCount = 0;

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function tenantEntry(tenantId: string): { aiTurns: number; messages: number } {
  const existing = tenantUsage.get(tenantId);

  if (existing) {
    return existing;
  }

  const next = { aiTurns: 0, messages: 0 };
  tenantUsage.set(tenantId, next);
  return next;
}

export const metrics = {
  observeHttpRequest(statusCode: number, latencyMs: number): void {
    httpRequestCount += 1;
    httpLatencies.push(latencyMs);

    if (httpLatencies.length > 1000) {
      httpLatencies.shift();
    }

    if (statusCode >= 500) {
      http5xxCount += 1;
    }
  },

  setWebhookQueueDepth(depth: number): void {
    webhookQueueDepth = depth;
  },

  incrementWebhookDlq(): void {
    webhookDlqCount += 1;
  },

  incrementWhatsappSendFailure(): void {
    whatsappSendFailureCount += 1;
  },

  incrementAiError(): void {
    aiErrorCount += 1;
  },

  incrementAppointmentConflict(): void {
    appointmentConflictCount += 1;
  },

  incrementTenantMessages(tenantId: string, count = 1): void {
    tenantEntry(tenantId).messages += count;
  },

  incrementTenantAiTurns(tenantId: string, count = 1): void {
    tenantEntry(tenantId).aiTurns += count;
  },

  snapshot(): MetricsSnapshot {
    return {
      aiErrorCount,
      appointmentConflictCount,
      http5xxCount,
      httpRequestCount,
      httpRequestLatencyMs: {
        count: httpLatencies.length,
        max: Math.max(0, ...httpLatencies),
        p95: percentile(httpLatencies, 95),
      },
      tenantUsage: Object.fromEntries(tenantUsage.entries()),
      webhookDlqCount,
      webhookQueueDepth,
      whatsappSendFailureCount,
    };
  },
};
