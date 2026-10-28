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

  /**
   * Publie les événements en attente ; renvoie le nombre réellement publié.
   * Le port est **par lot** (ADR 0007) : toutes les enveloppes validables du
   * lot partent dans une seule publication, un seul accusé. Une ligne dont
   * l'enveloppe serait invalide est rejetée isolément : elle ne bloque pas
   * son lot et son erreur reste lisible ligne par ligne.
   */
  async relay(limit = 50): Promise<{ examined: number; changed: number }> {
    const rows = await db
      .selectFrom('event_outbox')
      .selectAll()
      .where('published_at', 'is', null)
      .orderBy('occurred_at', 'asc')
      .orderBy('id', 'asc')
      .limit(limit)
      .execute();
    if (rows.length === 0) {
      return { examined: 0, changed: 0 };
    }

    const badIds: string[] = [];
    const badErrors: Array<{ id: string; error: string }> = [];
    const envelopes: EventEnvelope[] = [];
    for (const row of rows) {
      const parsed = EventEnvelopeSchema.safeParse({
        id: row.id,
        type: row.type,
        version: row.version,
        occurred_at: row.occurred_at.toISOString(),
        producer: 'football',
        payload: row.payload,
      });
      if (parsed.success) {
        envelopes.push(parsed.data);
      } else {
        badIds.push(row.id);
        badErrors.push({ id: row.id, error: parsed.error.message.slice(0, 500) });
      }
    }
    await this.reject(badErrors);

    if (envelopes.length === 0) {
      return { examined: rows.length, changed: 0 };
    }

    try {
      await this.bus.publish(envelopes);
    } catch (error) {
      await this.retryLater(
        envelopes.map((envelope) => envelope.id),
        error instanceof Error ? error.message.slice(0, 500) : 'publication failed',
      );
      return { examined: rows.length, changed: 0 };
    }

    const published = envelopes.map((envelope) => envelope.id);
    await db
      .updateTable('event_outbox')
      .set({ published_at: this.now() })
      .where('id', 'in', published)
      .where('published_at', 'is', null)
      .execute();

    return { examined: rows.length, changed: published.length };
  }

  /** Une enveloppe invalide est rejetée isolément, sans toucher son lot. */
  private async reject(errors: Array<{ id: string; error: string }>): Promise<void> {
    if (errors.length === 0) {
      return;
    }
    for (const { id, error } of errors) {
      await db
        .updateTable('event_outbox')
        .set({ attempts: sql`attempts + 1`, last_error: error })
        .where('id', '=', id)
        .where('published_at', 'is', null)
        .execute();
    }
  }

  /** Un échec de publication est rejouable : délai, tentative et erreur lisible. */
  private async retryLater(ids: string[], message: string): Promise<void> {
    await db
      .updateTable('event_outbox')
      .set({ attempts: sql`attempts + 1`, last_error: message })
      .where('id', 'in', ids)
      .where('published_at', 'is', null)
      .execute();
  }
}
