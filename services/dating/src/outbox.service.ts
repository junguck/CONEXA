import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEnvelopeSchema, type EventEnvelope, type EventPublisher } from '@conexa/events';
import { sql, type Kysely } from 'kysely';

import { db, type DatingDb } from './db.js';
import { DATING_CLOCK } from './profile.js';

export const DATING_EVENTS = Symbol('DATING_EVENTS');

/**
 * Outbox du domaine dating (ADR 0007) : l'enveloppe est écrite **dans la
 * transaction métier** — un rollback métier ne publie rien — puis relayée vers
 * le bus injecté. Un échec du bus laisse la ligne en attente avec un délai de
 * reprise croissant ; le résultat métier déjà commité n'est jamais annulé.
 */
@Injectable()
export class DatingOutboxService {
  private readonly logger = new Logger(DatingOutboxService.name);

  constructor(
    @Inject(DATING_CLOCK) private readonly now: () => Date,
    @Inject(DATING_EVENTS) private readonly bus: EventPublisher,
  ) {}

  /**
   * Écrit l'événement dans la transaction qui porte la donnée métier. L'appel
   * parse l'enveloppe d'abord : une enveloppe invalide n'atteint jamais la base.
   */
  async enqueue(trx: Kysely<DatingDb>, envelope: EventEnvelope): Promise<void> {
    const parsed: EventEnvelope = EventEnvelopeSchema.parse(envelope);
    await trx
      .insertInto('dating_outbox')
      .values({
        id: parsed.id,
        envelope: parsed,
        available_at: this.now(),
      })
      .execute();
  }

  /**
   * Publie les événements en attente ; renvoie le nombre réellement publié.
   * Le port est **par lot** (ADR 0007) : toutes les enveloppes valides du lot
   * partent dans une seule publication, un accusé. Une enveloppe invalide est
   * rejetée isolément : elle ne bloque pas son lot et son erreur reste lisible.
   */
  async relay(limit = 50): Promise<{ examined: number; changed: number; failed: number }> {
    const rows = await db
      .selectFrom('dating_outbox')
      .selectAll()
      .where('status', '=', 'pending')
      .where('available_at', '<=', this.now())
      .orderBy('id', 'asc')
      .limit(limit)
      .execute();
    if (rows.length === 0) {
      return { examined: 0, changed: 0, failed: 0 };
    }

    const due: Array<{ id: string; envelope: EventEnvelope }> = [];
    let rejectedRows = 0;
    for (const row of rows) {
      const parsed = EventEnvelopeSchema.safeParse(row.envelope);
      if (parsed.success && parsed.data.id === row.id) {
        due.push({ id: row.id, envelope: parsed.data });
      } else {
        // Une enveloppe corrompue ne peut pas être publiée : elle part en
        // échec définitif (failed) plutôt que de bloquer son lot à chaque relais.
        await this.fail(row.id, parsed.success ? 'id de ligne et enveloppe divergent' : parsed.error.message, true);
        rejectedRows += 1;
      }
    }

    if (due.length === 0) {
      return { examined: rows.length, changed: 0, failed: rejectedRows };
    }

    const envelopes = due.map((entry) => entry.envelope);
    try {
      await this.bus.publish(envelopes);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'publication failed';
      const retryAt = this.retryAfterInMinutes(due.length);
      await Promise.all(due.map((entry) => this.postpone(entry.id, message, retryAt)));
      return { examined: rows.length, changed: 0, failed: due.length };
    }

    await db
      .updateTable('dating_outbox')
      .set({ status: 'published' as const })
      .where(
        'id',
        'in',
        due.map((entry) => entry.id),
      )
      .execute();

    return { examined: rows.length, changed: due.length, failed: rejectedRows };
  }

  /**
   * Délai de reprise croissant (2^n minutes, plafonné à 15) : un bus tombé
   * reçoit moins de pression à chaque échec, comme dans @conexa/messaging.
   */
  private retryAfterInMinutes(attemptsCount: number): Date {
    const minutes = Math.min(15, 2 ** Math.min(attemptsCount, 4));
    return new Date(this.now().getTime() + minutes * 60_000);
  }

  private async fail(id: string, message: string, terminal: boolean): Promise<void> {
    await db
      .updateTable('dating_outbox')
      .set({
        attempts: sql`attempts + 1`,
        last_error: message,
        ...(terminal ? { status: 'failed' as const } : { available_at: this.retryAfterInMinutes(1) }),
      })
      .where('id', '=', id)
      .execute();
    this.logger.warn(`événement outbox dating repoussé : ${id} (${message})`);
  }

  private async postpone(id: string, message: string, retryAt: Date): Promise<void> {
    await db
      .updateTable('dating_outbox')
      .set({
        attempts: sql`attempts + 1`,
        last_error: message,
        available_at: retryAt,
      })
      .where('id', '=', id)
      .execute();
    this.logger.warn(`lot outbox dating repoussé (${message}) : ${id}`);
  }
}
