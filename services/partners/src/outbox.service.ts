import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEnvelopeSchema, type EventEnvelope, type EventPublisher } from '@conexa/events';
import { sql, type Kysely } from 'kysely';

import { db, type Database } from './db.js';

export const PARTNERS_EVENTS = Symbol('PARTNERS_EVENTS');
export const PARTNERS_CLOCK = Symbol('PARTNERS_CLOCK');

/**
 * Outbox du domaine partners (ADR 0007) : l'enveloppe est écrite dans la
 * transaction métier, puis relayée par lot vers le bus. Un échec du bus laisse
 * la ligne en attente avec un délai croissant ; la donnée commitée n'est jamais
 * annulée.
 */
@Injectable()
export class PartnersOutboxService {
  private readonly logger = new Logger(PartnersOutboxService.name);

  constructor(
    @Inject(PARTNERS_CLOCK) private readonly now: () => Date,
    @Inject(PARTNERS_EVENTS) private readonly bus: EventPublisher,
  ) {}

  /** Parse d'abord : une enveloppe invalide n'atteint jamais la base. */
  async enqueue(trx: Kysely<Database>, envelope: EventEnvelope): Promise<void> {
    const parsed = EventEnvelopeSchema.parse(envelope);
    await trx
      .insertInto('partners_outbox')
      .values({ id: parsed.id, envelope: parsed, available_at: this.now() })
      .execute();
  }

  async relay(limit = 50): Promise<{ examined: number; changed: number; failed: number }> {
    const rows = await db
      .selectFrom('partners_outbox')
      .selectAll()
      .where('status', '=', 'pending')
      .where('available_at', '<=', this.now())
      .orderBy('created_at', 'asc')
      .limit(limit)
      .execute();
    if (rows.length === 0) return { examined: 0, changed: 0, failed: 0 };

    const due: Array<{ id: string; envelope: EventEnvelope }> = [];
    let rejected = 0;
    for (const row of rows) {
      const parsed = EventEnvelopeSchema.safeParse(row.envelope);
      if (parsed.success && parsed.data.id === row.id) {
        due.push({ id: row.id, envelope: parsed.data });
      } else {
        // Enveloppe corrompue : échec définitif, elle ne bloque pas son lot.
        await this.mark(row.id, 'failed', 'enveloppe invalide');
        rejected += 1;
      }
    }
    if (due.length === 0) return { examined: rows.length, changed: 0, failed: rejected };

    try {
      await this.bus.publish(due.map((entry) => entry.envelope));
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'publication failed';
      const minutes = Math.min(15, 2 ** Math.min(due.length, 4));
      const retryAt = new Date(this.now().getTime() + minutes * 60_000);
      await db
        .updateTable('partners_outbox')
        .set({ attempts: sql<number>`attempts + 1`, last_error: message, available_at: retryAt })
        .where(
          'id',
          'in',
          due.map((entry) => entry.id),
        )
        .execute();
      this.logger.warn(`lot outbox partners repoussé (${message})`);
      return { examined: rows.length, changed: 0, failed: due.length + rejected };
    }

    await db
      .updateTable('partners_outbox')
      .set({ status: 'published' })
      .where(
        'id',
        'in',
        due.map((entry) => entry.id),
      )
      .execute();
    return { examined: rows.length, changed: due.length, failed: rejected };
  }

  private async mark(id: string, status: 'failed', message: string): Promise<void> {
    await db
      .updateTable('partners_outbox')
      .set({ status, attempts: sql<number>`attempts + 1`, last_error: message })
      .where('id', '=', id)
      .execute();
  }
}
