import { describe, expect, it } from 'vitest';
import {
  EventEnvelopeSchema,
  InMemoryEventBus,
  createEvent,
  type EventEnvelope,
  type EventHandler,
  type EventPublisher,
} from './index.js';

/**
 * Test miroir des événements (ADR 0007, T-0051). Les six fichiers v1 qui
 * publient un événement importent `createEvent`, `EventEnvelope`,
 * `EventPublisher` et `InMemoryEventBus` : ils doivent continuer à compiler,
 * sauf le passage au lot sur le port `EventPublisher`.
 */

const userId = '0b27a4d2-3d13-4f01-8b3a-9a9f3f6a6f11';

describe('surface v1 de @conexa/events', () => {
  it('garde EventEnvelopeSchema et createEvent', () => {
    const event = createEvent({
      type: 'match.scheduled',
      producer: 'football',
      payload: { match_id: userId },
    });
    expect(EventEnvelopeSchema.safeParse(event).success).toBe(true);
    expect(event.version).toBe(1);
  });

  it('InMemoryEventBus accepte encore un événement seul (appels v1)', async () => {
    const bus = new InMemoryEventBus();
    const seen: EventEnvelope[] = [];
    const handler: EventHandler = (event) => {
      seen.push(event);
    };
    bus.subscribe('match.scheduled', handler);

    await bus.publish(
      createEvent({ type: 'match.scheduled', producer: 'football', payload: { n: 1 } }),
    );

    expect(seen).toHaveLength(1);
    expect(bus.published.map((event) => event.type)).toEqual(['match.scheduled']);
  });

  it('InMemoryEventBus publie un lot dans l’ordre et filtre par type', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];
    bus.subscribe('match.scheduled', (event) => {
      received.push(event.type);
    });
    bus.subscribe('match.scheduled', (event) => {
      received.push(`second:${event.type}`);
    });
    bus.subscribe('team.created', (event) => {
      received.push(event.type);
    });

    await bus.publish([
      createEvent({ type: 'match.scheduled', producer: 'football', payload: {} }),
      createEvent({ type: 'team.created', producer: 'football', payload: {} }),
    ]);

    expect(received).toEqual(['match.scheduled', 'second:match.scheduled', 'team.created']);
  });

  it('le port EventPublisher ne publie que par lot', async () => {
    const batches: string[][] = [];
    const publisher: EventPublisher = {
      async publish(envelopes: EventEnvelope[]): Promise<void> {
        batches.push(envelopes.map((envelope) => envelope.id));
      },
    };
    const event = createEvent({ type: 'team.created', producer: 'football', payload: {} });

    await publisher.publish([event]);
    expect(batches).toEqual([[event.id]]);

    // L'appel unitaire ne doit pas compiler. Il n'est jamais exécuté : la
    // fonction n'existe que pour faire vérifier la signature par `tsc`.
    const publishOne = (envelope: EventEnvelope): Promise<void> =>
      // @ts-expect-error — publication unitaire refusée : le port attend un lot.
      publisher.publish(envelope);
    expect(publishOne).toBeTypeOf('function');
  });
});
