import { Inject, Injectable } from '@nestjs/common';
import { EventEnvelopeSchema, type EventEnvelope, type EventPublisher } from '@conexa/events';
import { sql, type Kysely } from 'kysely';

import { db } from './db.js';
import type { FootballDb } from './db.js';
import { FOOTBALL_CLOCK, FOOTBALL_EVENTS } from './shared.js';

export interface FootballEventDraft {
  type: string;
  payload: Record<string, unknown>;
  version?: number;
}

/**
 * Outbox du domaine : l'événement est écrit dans la transaction métier, puis
 * relayé vers le bus injecté. Un échec du bus laisse la ligne en attente et
 * n'annule jamais le résultat sportif (T-0034).
 */
@Injectable()
export class OutboxService {
  constructor(
    @Inject(FOOTBALL_CLOCK) private readonly now: () => Date,
    @Inject(FOOTBALL_EVENTS) private readonly bus: EventPublisher,
  ) {}

  async enqueue(trx: Kysely<FootballDb>, events: FootballEventDraft[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    const occurredAt = this.now();
    await trx
      .insertInto('event_outbox')
      .values(
        events.map((event) => ({
          type: event.type,
          version: event.version ?? 1,
          occurred_at: occurredAt,
          payload: event.payload,
        })),
      )
      .execute();
  }

  /** Publie les événements en attente ; renvoie le nombre réellement publié. */
  async relay(limit = 50): Promise<{ examined: number; changed: number }> {
    const rows = await db
      .selectFrom('event_outbox')
      .selectAll()
      .where('published_at', 'is', null)
      .orderBy('occurred_at', 'asc')
      .orderBy('id', 'asc')
      .limit(limit)
      .execute();

    let changed = 0;
    for (const row of rows) {
      const envelope: EventEnvelope = EventEnvelopeSchema.parse({
        id: row.id,
        type: row.type,
        version: row.version,
        occurred_at: row.occurred_at.toISOString(),
        producer: 'football',
        payload: row.payload,
      });
      try {
        await this.bus.publish(envelope);
        await db
          .updateTable('event_outbox')
          .set({ published_at: this.now() })
          .where('id', '=', row.id)
          .where('published_at', 'is', null)
          .execute();
        changed += 1;
      } catch (error) {
        await db
          .updateTable('event_outbox')
          .set({
            attempts: sql`attempts + 1`,
            last_error: error instanceof Error ? error.message.slice(0, 500) : 'publication failed',
          })
          .where('id', '=', row.id)
          .where('published_at', 'is', null)
          .execute();
      }
    }

    return { examined: rows.length, changed };
  }
}
