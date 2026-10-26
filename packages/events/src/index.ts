import { z } from 'zod';

/** Enveloppe commune : un événement = un producteur + une version (ADR 0003). */
export const EventEnvelopeSchema = z.object({
  id: z.uuid(),
  type: z.string().min(3),
  version: z.number().int().positive(),
  occurred_at: z.iso.datetime({ offset: true }),
  producer: z.string().min(2),
  traceparent: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
});

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

export interface EventPublisher {
  publish(event: EventEnvelope): Promise<void>;
}

export type EventHandler = (event: EventEnvelope) => Promise<void> | void;

/**
 * Bus en mémoire : sert aux tests et au développement local.
 * La publication durable (outbox RabbitMQ) arrive avec la tâche d'infrastructure ;
 * les consommateurs doivent rester idempotents (ARCHITECTURE.md §1).
 */
export class InMemoryEventBus implements EventPublisher {
  private readonly handlers = new Map<string, EventHandler[]>();
  readonly published: EventEnvelope[] = [];

  subscribe(type: string, handler: EventHandler): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
    return () => {
      this.handlers.set(
        type,
        (this.handlers.get(type) ?? []).filter((registered) => registered !== handler),
      );
    };
  }

  async publish(event: EventEnvelope): Promise<void> {
    const valid = EventEnvelopeSchema.parse(event);
    this.published.push(valid);
    for (const handler of this.handlers.get(valid.type) ?? []) {
      await handler(valid);
    }
  }
}

export function createEvent(input: {
  type: string;
  producer: string;
  payload: Record<string, unknown>;
  traceparent?: string;
  version?: number;
}): EventEnvelope {
  return EventEnvelopeSchema.parse({
    id: crypto.randomUUID(),
    type: input.type,
    version: input.version ?? 1,
    occurred_at: new Date().toISOString(),
    producer: input.producer,
    ...(input.traceparent === undefined ? {} : { traceparent: input.traceparent }),
    payload: input.payload,
  });
}
