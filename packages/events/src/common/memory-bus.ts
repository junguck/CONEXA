import { eventEnvelopeSchema, type EventEnvelope } from './envelope.js';
import type { EventHandler, EventPublisher } from './publisher.js';

/**
 * Bus en mémoire : sert aux tests et au développement local.
 *
 * `publish` accepte un événement seul ou un lot : c'est le seul écart
 * volontaire avec le port `EventPublisher` (ADR 0007), pour que les appels v1
 * `bus.publish(createEvent(...))` continuent de compiler. La publication
 * durable (outbox `@conexa/messaging`) reste la seule voie en production.
 *
 * La validation ici est structurelle ; le garde-fou PII s'applique à travers
 * `parseEvent`, que les producteurs doivent utiliser.
 */
export class InMemoryEventBus implements EventPublisher {
  private readonly handlers = new Map<string, EventHandler[]>();

  /** Historique des événements publiés (utile aux assertions de test). */
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

  async publish(envelopes: EventEnvelope | EventEnvelope[]): Promise<void> {
    const batch = Array.isArray(envelopes) ? envelopes : [envelopes];
    for (const envelope of batch) {
      const valid = eventEnvelopeSchema.parse(envelope);
      this.published.push(valid);
      for (const handler of this.handlers.get(valid.type) ?? []) {
        await handler(valid);
      }
    }
  }
}
