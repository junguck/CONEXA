import { describe, expect, it, vi } from 'vitest';

import { createEvent, EventEnvelopeSchema, InMemoryEventBus } from './index.js';

describe('enveloppe d’événement', () => {
  it('refuse un identifiant ou une date invalides', () => {
    expect(
      EventEnvelopeSchema.safeParse({
        id: 'pas-un-uuid',
        type: 'match.validated',
        version: 1,
        occurred_at: new Date().toISOString(),
        producer: 'football',
        payload: {},
      }).success,
    ).toBe(false);
  });

  it('crée un événement valide et versionné', () => {
    const event = createEvent({
      type: 'match.validated',
      producer: 'football',
      payload: { id: 'x' },
    });
    expect(event.version).toBe(1);
    expect(EventEnvelopeSchema.safeParse(event).success).toBe(true);
  });
});

describe('bus en mémoire', () => {
  it('livre aux abonnés du bon type et permet de se désabonner', async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe('match.validated', handler);

    await bus.publish(createEvent({ type: 'match.validated', producer: 'football', payload: {} }));
    await bus.publish(createEvent({ type: 'team.created', producer: 'football', payload: {} }));
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    await bus.publish(createEvent({ type: 'match.validated', producer: 'football', payload: {} }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(bus.published).toHaveLength(3);
  });
});
