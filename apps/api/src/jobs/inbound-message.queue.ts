import type { NormalizedInboundMessageEvent } from "../integrations/whatsapp";
import type { InboundMessageProcessor } from "./process-inbound-message";

export class InboundMessageQueue {
  private pending = 0;
  private idleResolvers: Array<() => void> = [];

  constructor(private readonly processor: InboundMessageProcessor) {}

  enqueue(events: NormalizedInboundMessageEvent[]): void {
    for (const event of events) {
      this.pending += 1;
      setImmediate(() => {
        void this.processor
          .process(event)
          .catch((error: unknown) => {
            console.error(
              JSON.stringify({
                level: "error",
                message: "Inbound WhatsApp worker failed",
                errorName: error instanceof Error ? error.name : "UnknownError",
              }),
            );
          })
          .finally(() => {
            this.pending -= 1;
            this.resolveIdleIfNeeded();
          });
      });
    }

    this.resolveIdleIfNeeded();
  }

  async onIdle(): Promise<void> {
    if (this.pending === 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  private resolveIdleIfNeeded(): void {
    if (this.pending !== 0) {
      return;
    }

    const resolvers = this.idleResolvers.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  }
}
