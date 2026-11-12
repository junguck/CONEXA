import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEnvelopeSchema } from '@conexa/events';
import { PAYMENTS_EVENTS } from '@conexa/contracts';
import { notFound } from '@conexa/errors';
import { sql } from 'kysely';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { db } from './db.js';
import { DATING_CLOCK } from './profile.js';
import {
  transition,
  type SagaAction,
  type SagaEvent,
  type SagaSnapshot,
} from './reservation.machine.js';
import {
  PARTNERS_PORT,
  PAYMENTS_PORT,
  type PartnersPort,
  type PaymentsPort,
} from './reservation.ports.js';

/** Une action « en cours » dont le travailleur a disparu est reprise après ce délai. */
const CLAIM_MINUTES = 2;
const MAX_ATTEMPTS = 8;

const HOLD_EVENT_PAYLOAD = z.object({ hold_ref: z.string(), reason: z.string().optional() });
const PAYMENT_EVENT_PAYLOAD = z.object({
  payment_id: z.uuid(),
  object_type: z.string(),
  object_id: z.string(),
});

type Trx = Parameters<Parameters<ReturnType<typeof db.transaction>['execute']>[0]>[0];

export interface SagaView {
  date_id: string;
  state: SagaSnapshot['state'];
  failure_reason: SagaSnapshot['reason'];
  payment_id: string | null;
  attempt: number;
}

/**
 * Saga de réservation d'un date (ARCHITECTURE.md §6.1). L'état et ses actions
 * sont écrits dans la même transaction ; l'exécuteur reprend toute action non
 * terminée, donc un crash entre deux appels ne perd rien. Chaque appel sortant
 * est idempotent chez le destinataire.
 */
@Injectable()
export class ReservationSagaService {
  private readonly logger = new Logger(ReservationSagaService.name);

  constructor(
    @Inject(DATING_CLOCK) private readonly now: () => Date,
    @Inject(PARTNERS_PORT) private readonly partners: PartnersPort,
    @Inject(PAYMENTS_PORT) private readonly payments: PaymentsPort,
  ) {}

  /** Démarre (ou relance après échec) la réservation d'un créneau pour un date. */
  async start(dateId: string, slotId: string, venueId: string): Promise<SagaView> {
    return db.transaction().execute(async (trx) => {
      const date = await trx
        .selectFrom('dates')
        .select(['id', 'status'])
        .where('id', '=', dateId)
        .forUpdate()
        .executeTakeFirst();
      if (!date) throw notFound('Date');

      const existing = await trx
        .selectFrom('reservation_sagas')
        .selectAll()
        .where('date_id', '=', dateId)
        .forUpdate()
        .executeTakeFirst();
      const result = transition(existing ? snapshotOf(existing) : null, { type: 'started' });
      if (!result.changed && existing) return viewOf(existing);

      const attempt = existing ? existing.attempt + 1 : 1;
      const holdRef = `${dateId}:${attempt}`;
      const now = this.now();
      if (existing) {
        await trx
          .updateTable('reservation_sagas')
          .set({
            state: result.next.state,
            failure_reason: result.next.reason,
            payment_id: result.next.payment_id,
            slot_id: slotId,
            venue_id: venueId,
            hold_ref: holdRef,
            attempt,
            updated_at: now,
          })
          .where('date_id', '=', dateId)
          .execute();
      } else {
        await trx
          .insertInto('reservation_sagas')
          .values({
            date_id: dateId,
            state: result.next.state,
            failure_reason: result.next.reason,
            hold_ref: holdRef,
            slot_id: slotId,
            venue_id: venueId,
            payment_id: null,
            attempt,
            updated_at: now,
          })
          .execute();
      }
      await this.enqueue(
        trx,
        dateId,
        attempt,
        { hold_ref: holdRef, slot_id: slotId, venue_id: venueId },
        result.actions,
      );
      return {
        date_id: dateId,
        state: result.next.state,
        failure_reason: result.next.reason,
        payment_id: result.next.payment_id,
        attempt,
      };
    });
  }

  /** Applique un événement à la saga ; rejouer le même événement ne change rien. */
  async dispatch(dateId: string, event: SagaEvent): Promise<SagaView | null> {
    return db.transaction().execute(async (trx) => {
      const saga = await trx
        .selectFrom('reservation_sagas')
        .selectAll()
        .where('date_id', '=', dateId)
        .forUpdate()
        .executeTakeFirst();
      if (!saga) return null;
      const result = transition(snapshotOf(saga), event);
      if (!result.changed) return viewOf(saga);
      await trx
        .updateTable('reservation_sagas')
        .set({
          state: result.next.state,
          failure_reason: result.next.reason,
          payment_id: result.next.payment_id,
          updated_at: this.now(),
        })
        .where('date_id', '=', dateId)
        .execute();
      await this.enqueue(
        trx,
        dateId,
        saga.attempt,
        { hold_ref: saga.hold_ref, slot_id: saga.slot_id, venue_id: saga.venue_id },
        result.actions,
      );
      return {
        date_id: dateId,
        state: result.next.state,
        failure_reason: result.next.reason,
        payment_id: result.next.payment_id,
        attempt: saga.attempt,
      };
    });
  }

  async get(dateId: string): Promise<SagaView | null> {
    const row = await db
      .selectFrom('reservation_sagas')
      .selectAll()
      .where('date_id', '=', dateId)
      .executeTakeFirst();
    return row ? viewOf(row) : null;
  }

  /**
   * Consomme `slot.released` (expiration) et `payment.escrowed|failed` d'un date.
   * Idempotent par identifiant d'événement ; un événement d'une tentative
   * précédente (hold_ref périmé) est ignoré.
   */
  async handleEnvelope(raw: unknown): Promise<{ outcome: string }> {
    const envelope = EventEnvelopeSchema.parse(raw);

    let target: { dateId: string; event: SagaEvent; holdRef?: string } | null = null;
    if (envelope.type === 'slot.released' && envelope.producer === 'partners') {
      const payload = HOLD_EVENT_PAYLOAD.parse(envelope.payload);
      if (payload.reason === 'expired') {
        const dateId = payload.hold_ref.split(':')[0] ?? '';
        target = { dateId, event: { type: 'hold_expired' }, holdRef: payload.hold_ref };
      }
    } else if (
      (envelope.type === PAYMENTS_EVENTS.escrowed || envelope.type === PAYMENTS_EVENTS.failed) &&
      envelope.producer === 'payments'
    ) {
      const payload = PAYMENT_EVENT_PAYLOAD.parse(envelope.payload);
      if (payload.object_type === 'date') {
        target = {
          dateId: payload.object_id,
          event:
            envelope.type === PAYMENTS_EVENTS.escrowed
              ? { type: 'payment_escrowed', payment_id: payload.payment_id }
              : { type: 'payment_failed' },
        };
      }
    }
    if (!target) return { outcome: 'ignored' };

    const { dateId, event, holdRef } = target;
    // Pas d'inbox : la machine est idempotente (un rejeu est sans effet) et un
    // `slot.released` d'une tentative précédente est écarté par son `hold_ref`.
    if (holdRef) {
      const row = await db
        .selectFrom('reservation_sagas')
        .select('hold_ref')
        .where('date_id', '=', dateId)
        .executeTakeFirst();
      if (!row || row.hold_ref !== holdRef) return { outcome: 'stale' };
    }
    const view = await this.dispatch(dateId, event);
    return { outcome: view ? 'applied' : 'unknown_saga' };
  }

  /** Exécute les actions dues ; renvoie le nombre d'actions terminées. */
  async runDue(limit = 20): Promise<{ claimed: number; done: number; failed: number }> {
    const now = this.now();
    const claimUntil = new Date(now.getTime() + CLAIM_MINUTES * 60_000);
    const claimed = await db
      .updateTable('reservation_actions')
      .set({ status: 'running', available_at: claimUntil, attempts: sql<number>`attempts + 1` })
      .where(
        'id',
        'in',
        db
          .selectFrom('reservation_actions')
          .select('id')
          .where('status', 'in', ['pending', 'running'])
          .where('available_at', '<=', now)
          .orderBy('created_at', 'asc')
          .limit(limit)
          .forUpdate()
          .skipLocked(),
      )
      .returning(['id', 'date_id', 'kind', 'payload', 'attempts'])
      .execute();

    let done = 0;
    let failed = 0;
    for (const action of claimed) {
      try {
        await this.execute(action.date_id, action.kind, action.payload as Record<string, string>);
        await db
          .updateTable('reservation_actions')
          .set({ status: 'done', last_error: null })
          .where('id', '=', action.id)
          .execute();
        done += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 300) : 'échec';
        const terminal = action.attempts >= MAX_ATTEMPTS;
        const backoff = Math.min(15, 2 ** Math.min(action.attempts, 4));
        await db
          .updateTable('reservation_actions')
          .set({
            status: terminal ? 'failed' : 'pending',
            last_error: message,
            available_at: new Date(this.now().getTime() + backoff * 60_000),
          })
          .where('id', '=', action.id)
          .execute();
        this.logger.warn(`action de réservation repoussée (${action.kind}) : ${message}`);
        failed += 1;
      }
    }
    return { claimed: claimed.length, done, failed };
  }

  private async execute(
    dateId: string,
    kind: SagaAction['kind'],
    payload: Record<string, string>,
  ): Promise<void> {
    switch (kind) {
      case 'request_hold': {
        const outcome = await this.partners.hold(payload.slot_id!, payload.hold_ref!);
        if (outcome.status === 'rejected') {
          await this.dispatch(dateId, { type: 'hold_rejected' });
          return;
        }
        // Contrat Partners : `starts_at` accompagne toute retenue. Sans lui, la
        // fenêtre d'annulation de 3 h ne peut pas être appliquée : on refuse
        // plutôt que de deviner.
        if (!outcome.starts_at) {
          throw new Error('contrat Partners incomplet : starts_at absent de la retenue');
        }
        await db
          .updateTable('dates')
          .set({
            slot_id: payload.slot_id!,
            restaurant_id: payload.venue_id!,
            slot_starts_at: new Date(outcome.starts_at),
          })
          .where('id', '=', dateId)
          .execute();
        await this.dispatch(dateId, { type: 'hold_ok' });
        return;
      }
      case 'confirm_hold': {
        const result = await this.partners.confirm(payload.hold_ref!);
        await this.dispatch(dateId, {
          type: result.status === 'confirmed' ? 'hold_confirmed' : 'confirm_failed',
        });
        return;
      }
      case 'release_hold':
        await this.partners.release(payload.hold_ref!);
        return;
      case 'refund_payment':
        await this.payments.refund(payload.payment_id!);
        return;
      case 'confirm_date':
        await db
          .updateTable('dates')
          .set({ status: 'confirmed' })
          .where('id', '=', dateId)
          .where('status', 'in', ['negotiating', 'awaiting_payment'])
          .execute();
        return;
    }
  }

  private async enqueue(
    trx: Trx,
    dateId: string,
    attempt: number,
    base: { hold_ref: string; slot_id: string; venue_id: string },
    actions: SagaAction[],
  ): Promise<void> {
    for (const action of actions) {
      const payload =
        action.kind === 'refund_payment' ? { ...base, payment_id: action.payment_id } : base;
      await trx
        .insertInto('reservation_actions')
        .values({
          id: randomUUID(),
          date_id: dateId,
          kind: action.kind,
          payload,
          last_error: null,
          available_at: this.now(),
          dedupe_key: `${action.kind}:${attempt}:${action.kind === 'refund_payment' ? action.payment_id : ''}`,
        })
        .onConflict((oc) => oc.columns(['date_id', 'dedupe_key']).doNothing())
        .execute();
    }
  }
}

function snapshotOf(row: {
  state: SagaSnapshot['state'];
  failure_reason: SagaSnapshot['reason'];
  payment_id: string | null;
}): SagaSnapshot {
  return { state: row.state, reason: row.failure_reason, payment_id: row.payment_id };
}

function viewOf(row: {
  date_id: string;
  state: SagaSnapshot['state'];
  failure_reason: SagaSnapshot['reason'];
  payment_id: string | null;
  attempt: number;
}): SagaView {
  return {
    date_id: row.date_id,
    state: row.state,
    failure_reason: row.failure_reason,
    payment_id: row.payment_id,
    attempt: row.attempt,
  };
}
