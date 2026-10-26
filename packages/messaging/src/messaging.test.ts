import { describe, expect, it } from 'vitest';
import { buildEvent, type EventEnvelope } from '@conexa/events';
import {
  InMemoryInboxStore,
  InMemoryOutboxStore,
  OutboxDispatcher,
  amqpHeaders,
  backoffDelayMs,
  consumeIdempotent,
  pendingRecord,
  serviceTopology,
  traceparentFromHeaders,
  type EventPublisher,
} from './index.js';

const start = new Date('2026-10-26T10:00:00Z');
const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

const event = buildEvent({
  type: 'user.approved',
  producer: 'identity',
  payload: { user_id: '0b27a4d2-3d13-4f01-8b3a-9a9f3f6a6f11' },
  occurredAt: start,
  traceparent,
});

class RecordingPublisher implements EventPublisher {
  readonly batches: string[][] = [];
  private readonly failure: string | undefined;

  constructor(failure?: string) {
    this.failure = failure;
  }

  async publish(envelopes: EventEnvelope[]): Promise<void> {
    if (this.failure !== undefined) throw new Error(this.failure);
    this.batches.push(envelopes.map((envelope) => envelope.id));
  }
}

describe('reprise à délai croissant', () => {
  it('double le délai à chaque tentative, sans jitter quand random = 0.5', () => {
    const delays = [1, 2, 3, 4].map((attempt) => backoffDelayMs(attempt, undefined, () => 0.5));
    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000]);
  });

  it('plafonne le délai et reste dans la marge de jitter', () => {
    expect(backoffDelayMs(20, undefined, () => 0.5)).toBe(60_000);
    expect(backoffDelayMs(3, undefined, () => 0)).toBe(3_200);
    expect(backoffDelayMs(3, undefined, () => 1)).toBe(4_800);
  });
});

describe('outbox', () => {
  it('publie le lot et marque les messages publiés', async () => {
    const store = new InMemoryOutboxStore();
    await store.enqueue([pendingRecord(event, start)]);
    const publisher = new RecordingPublisher();
    const dispatcher = new OutboxDispatcher(store, publisher, { now: () => start });

    const report = await dispatcher.flush();

    expect(report).toEqual({ published: 1, retried: 0, failed: 0 });
    expect(publisher.batches).toEqual([[event.id]]);
    expect(store.all()[0]?.status).toBe('published');
  });

  it('replanifie après échec, puis bascule en file des échecs', async () => {
    const store = new InMemoryOutboxStore();
    await store.enqueue([pendingRecord(event, start)]);
    let clock = start;
    const dispatcher = new OutboxDispatcher(store, new RecordingPublisher('broker injoignable'), {
      maxAttempts: 2,
      random: () => 0.5,
      now: () => clock,
    });

    expect(await dispatcher.flush()).toEqual({ published: 0, retried: 1, failed: 0 });
    const afterRetry = store.all()[0];
    expect(afterRetry?.status).toBe('pending');
    expect(afterRetry?.attempts).toBe(1);
    expect(afterRetry?.last_error).toBe('broker injoignable');
    expect(Date.parse(afterRetry?.available_at ?? '')).toBeGreaterThan(clock.getTime());

    // Avant l'échéance, rien n'est réclamé.
    expect(await dispatcher.flush()).toEqual({ published: 0, retried: 0, failed: 0 });

    clock = new Date(start.getTime() + 5_000);
    expect(await dispatcher.flush()).toEqual({ published: 0, retried: 0, failed: 1 });
    expect(store.all()[0]?.status).toBe('failed');
    expect(store.all()[0]?.attempts).toBe(2);
  });

  it('ne réclame pas un message pas encore dû', async () => {
    const store = new InMemoryOutboxStore();
    await store.enqueue([pendingRecord(event, start)]);
    expect(await store.claim(10, new Date(start.getTime() - 1))).toHaveLength(0);
    expect(await store.claim(10, start)).toHaveLength(1);
  });
});

describe('inbox idempotente', () => {
  it('traite une fois puis ignore le doublon', async () => {
    const inbox = new InMemoryInboxStore();
    let handled = 0;
    const handler = async (): Promise<void> => {
      handled += 1;
    };

    expect(await consumeIdempotent(inbox, 'identity', event.id, handler, () => start)).toBe(
      'handled',
    );
    expect(await consumeIdempotent(inbox, 'identity', event.id, handler, () => start)).toBe(
      'duplicate',
    );
    expect(handled).toBe(1);
  });

  it('n’inscrit rien quand le traitement échoue, pour permettre la reprise', async () => {
    const inbox = new InMemoryInboxStore();
    await expect(
      consumeIdempotent(inbox, 'identity', event.id, async () => {
        throw new Error('échec métier');
      }),
    ).rejects.toThrow('échec métier');
    expect(await inbox.has('identity', event.id)).toBe(false);
  });
});

describe('topologie RabbitMQ', () => {
  it('déclare une file durable, une file de reprise à TTL et une file des échecs', () => {
    const topology = serviceTopology('football', ['user.approved', 'match.*']);
    expect(topology.exchange).toBe('conexa.events');
    expect(topology.queues.map((queue) => queue.name)).toEqual([
      'football.events',
      'football.retry',
      'football.failed',
    ]);
    expect(topology.queues.every((queue) => queue.durable)).toBe(true);
    expect(topology.queues[1]?.arguments?.['x-dead-letter-exchange']).toBe('conexa.events');
    expect(topology.bindings).toEqual([
      { queue: 'football.events', pattern: 'user.approved' },
      { queue: 'football.events', pattern: 'match.*' },
    ]);
  });

  it('propage le traceparent dans les en-têtes et le relit', () => {
    const headers = amqpHeaders(event);
    expect(headers['message-id']).toBe(event.id);
    expect(headers['message-version']).toBe('1');
    expect(traceparentFromHeaders(headers)).toBe(traceparent);
    expect(traceparentFromHeaders({ traceparent: 'invalide' })).toBeUndefined();
    expect(traceparentFromHeaders(undefined)).toBeUndefined();
  });
});
