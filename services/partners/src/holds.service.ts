import { Inject, Injectable } from '@nestjs/common';
import { buildEvent } from '@conexa/events';
import { notFound } from '@conexa/errors';
import { randomUUID } from 'node:crypto';

import { db } from './db.js';
import {
  canConfirm,
  canRelease,
  holdExpiry,
  holdVerdict,
  type HoldRejection,
  type HoldStatus,
} from './holds.rules.js';
import { PARTNERS_CLOCK, PartnersOutboxService } from './outbox.service.js';

export type HoldResult =
  | { status: 'held'; hold_id: string; expires_at: string }
  | { status: 'rejected'; reason: HoldRejection };

/**
 * Retenue de créneau de 15 minutes (F4.1). Le verrou de ligne sur le créneau
 * sérialise les demandes concurrentes : sur la dernière table, une seule passe.
 * Chaque changement d'état écrit son événement `slot.*` dans la même
 * transaction (outbox) ; la demande est idempotente par `hold_ref`.
 */
@Injectable()
export class SlotHoldsService {
  constructor(
    @Inject(PARTNERS_CLOCK) private readonly now: () => Date,
    private readonly outbox: PartnersOutboxService,
  ) {}

  async hold(slotId: string, holdRef: string): Promise<HoldResult> {
    return db.transaction().execute(async (trx) => {
      const slot = await trx
        .selectFrom('slots')
        .selectAll()
        .where('id', '=', slotId)
        .forUpdate()
        .executeTakeFirst();
      if (!slot) throw notFound('Créneau');

      // Rejeu : la même réservation retrouve sa retenue sans en créer une autre.
      const existing = await trx
        .selectFrom('slot_holds')
        .selectAll()
        .where('hold_ref', '=', holdRef)
        .executeTakeFirst();
      const now = this.now();
      if (existing) {
        if (existing.slot_id !== slotId) {
          return this.reject(trx, slot, holdRef, 'SLOT_NOT_OPEN');
        }
        if (existing.status === 'held' || existing.status === 'confirmed') {
          return {
            status: 'held',
            hold_id: existing.id,
            expires_at: existing.expires_at.toISOString(),
          };
        }
        return this.reject(trx, slot, holdRef, 'SLOT_NOT_OPEN');
      }

      const holds = await trx
        .selectFrom('slot_holds')
        .select(['status', 'expires_at'])
        .where('slot_id', '=', slotId)
        .where('status', 'in', ['held', 'confirmed'])
        .execute();
      const verdict = holdVerdict(slot, holds, now);
      if (!verdict.ok) return this.reject(trx, slot, holdRef, verdict.reason);

      const id = randomUUID();
      const expiresAt = holdExpiry(now);
      await trx
        .insertInto('slot_holds')
        .values({
          id,
          slot_id: slotId,
          hold_ref: holdRef,
          status: 'held',
          expires_at: expiresAt,
          updated_at: now,
        })
        .execute();
      await this.emit(trx, 'slot.held', {
        hold_ref: holdRef,
        slot_id: slotId,
        venue_id: slot.venue_id,
        expires_at: expiresAt.toISOString(),
      });
      return { status: 'held', hold_id: id, expires_at: expiresAt.toISOString() };
    });
  }

  /** La réservation est payée : la retenue devient définitive (plus d'expiration). */
  async confirm(holdRef: string): Promise<{ status: HoldStatus }> {
    return db.transaction().execute(async (trx) => {
      const hold = await trx
        .selectFrom('slot_holds')
        .selectAll()
        .where('hold_ref', '=', holdRef)
        .forUpdate()
        .executeTakeFirst();
      if (!hold) throw notFound('Retenue');
      if (hold.status === 'confirmed') return { status: 'confirmed' as const };
      if (!canConfirm(hold, this.now())) {
        // Échue (balayée ou non) ou libérée : la saga doit compenser.
        return { status: hold.status === 'held' ? ('expired' as const) : hold.status };
      }
      await trx
        .updateTable('slot_holds')
        .set({ status: 'confirmed', updated_at: this.now() })
        .where('id', '=', hold.id)
        .execute();
      return { status: 'confirmed' as const };
    });
  }

  /** Annulation de la réservation : la place est rendue et l'événement émis. */
  async release(holdRef: string): Promise<{ status: HoldStatus }> {
    return db.transaction().execute(async (trx) => {
      const hold = await trx
        .selectFrom('slot_holds')
        .innerJoin('slots', 'slots.id', 'slot_holds.slot_id')
        .select([
          'slot_holds.id as id',
          'slot_holds.slot_id as slot_id',
          'slot_holds.status as status',
          'slot_holds.expires_at as expires_at',
          'slots.venue_id as venue_id',
        ])
        .where('slot_holds.hold_ref', '=', holdRef)
        .forUpdate('slot_holds')
        .executeTakeFirst();
      if (!hold) throw notFound('Retenue');
      if (!canRelease(hold)) return { status: hold.status };
      await trx
        .updateTable('slot_holds')
        .set({ status: 'released', updated_at: this.now() })
        .where('id', '=', hold.id)
        .execute();
      await this.emit(trx, 'slot.released', {
        hold_ref: holdRef,
        slot_id: hold.slot_id,
        venue_id: hold.venue_id,
        reason: 'cancelled',
      });
      return { status: 'released' as const };
    });
  }

  /**
   * Balayage : toute retenue `held` échue passe en `expired` et publie
   * `slot.released`. `skip locked` : deux balayages concurrents ne traitent
   * jamais la même ligne ; rejouer le balayage ne change rien.
   */
  async sweepExpired(limit = 100): Promise<{ examined: number; changed: number }> {
    return db.transaction().execute(async (trx) => {
      const now = this.now();
      const due = await trx
        .selectFrom('slot_holds')
        .innerJoin('slots', 'slots.id', 'slot_holds.slot_id')
        .select([
          'slot_holds.id as id',
          'slot_holds.hold_ref as hold_ref',
          'slot_holds.slot_id as slot_id',
          'slots.venue_id as venue_id',
        ])
        .where('slot_holds.status', '=', 'held')
        .where('slot_holds.expires_at', '<=', now)
        .orderBy('slot_holds.expires_at', 'asc')
        .limit(limit)
        .forUpdate('slot_holds')
        .skipLocked()
        .execute();
      for (const hold of due) {
        await trx
          .updateTable('slot_holds')
          .set({ status: 'expired', updated_at: now })
          .where('id', '=', hold.id)
          .execute();
        await this.emit(trx, 'slot.released', {
          hold_ref: hold.hold_ref,
          slot_id: hold.slot_id,
          venue_id: hold.venue_id,
          reason: 'expired',
        });
      }
      return { examined: due.length, changed: due.length };
    });
  }

  private async reject(
    trx: Parameters<Parameters<ReturnType<typeof db.transaction>['execute']>[0]>[0],
    slot: { id: string; venue_id: string },
    holdRef: string,
    reason: HoldRejection,
  ): Promise<HoldResult> {
    await this.emit(trx, 'slot.rejected', {
      hold_ref: holdRef,
      slot_id: slot.id,
      venue_id: slot.venue_id,
      reason,
    });
    return { status: 'rejected', reason };
  }

  private async emit(
    trx: Parameters<Parameters<ReturnType<typeof db.transaction>['execute']>[0]>[0],
    type: 'slot.held' | 'slot.rejected' | 'slot.released',
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.outbox.enqueue(
      trx,
      buildEvent({ type, producer: 'partners', payload, occurredAt: this.now() }),
    );
  }
}
