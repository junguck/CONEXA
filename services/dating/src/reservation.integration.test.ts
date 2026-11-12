import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildEvent } from '@conexa/events';

import type { HoldOutcome, PartnersPort, PaymentsPort } from './reservation.ports.js';

/**
 * Test d'intégration opt-in :
 *   DATING_TEST_DATABASE_URL=postgres://… pnpm --filter @conexa/dating test
 * Les ports Partners et Payments sont des doublures avec pannes injectables.
 */
const TEST_DATABASE_URL = process.env.DATING_TEST_DATABASE_URL;
const n = (k: number) => `6${k.toString().padStart(7, '0')}-0000-4000-8000-000000000000`;
const SLOT = n(900);
const VENUE = n(901);
const PAY1 = n(800);
const PAY2 = n(801);

class FakePartners implements PartnersPort {
  calls: string[] = [];
  holdResult: HoldOutcome = {
    status: 'held',
    expires_at: '2026-11-09T10:15:00.000Z',
    starts_at: '2026-11-16T16:00:00.000Z',
  };
  confirmResult = 'confirmed';
  failNext = 0;
  async hold(slotId: string, holdRef: string) {
    this.maybeFail();
    this.calls.push(`hold:${holdRef}`);
    return this.holdResult;
  }
  async confirm(holdRef: string) {
    this.maybeFail();
    this.calls.push(`confirm:${holdRef}`);
    return { status: this.confirmResult };
  }
  async release(holdRef: string) {
    this.maybeFail();
    this.calls.push(`release:${holdRef}`);
    return { status: 'released' };
  }
  private maybeFail() {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error('Partners indisponible');
    }
  }
}

class FakePayments implements PaymentsPort {
  refunds: string[] = [];
  async refund(paymentId: string) {
    this.refunds.push(paymentId);
  }
}

describe.skipIf(!TEST_DATABASE_URL)('saga de réservation sur PostgreSQL', () => {
  let db: typeof import('./db.js').db;
  let saga: import('./reservation.service.js').ReservationSagaService;
  let partners: FakePartners;
  let payments: FakePayments;
  let clock = new Date('2026-11-09T10:00:00Z');
  const dateIds: string[] = [];
  const profileIds: string[] = [];

  async function makeDate(k: number): Promise<string> {
    const a = n(k * 10 + 1);
    const b = n(k * 10 + 2);
    const inviteId = n(k * 10 + 3);
    const dateId = n(k * 10 + 4);
    profileIds.push(a, b);
    for (const userId of [a, b]) {
      await db
        .insertInto('dating_profiles')
        .values({
          user_id: userId,
          birth_date: new Date('2003-05-12T00:00:00Z'),
          gender: userId === a ? 'male' : 'female',
          questionnaire_v: 1,
          answers: {},
          seeking: ['female'],
          age_min: 18,
          age_max: 35,
        })
        .execute();
    }
    await db
      .insertInto('invites')
      .values({ id: inviteId, from_user_id: a, to_user_id: b, week_start: '2026-11-09' })
      .execute();
    await db
      .insertInto('dates')
      .values({
        id: dateId,
        invite_id: inviteId,
        user_a: a,
        user_b: b,
        payer_id: a,
        checkin_code: `CODE${k}`,
      } as never)
      .execute();
    dateIds.push(dateId);
    return dateId;
  }

  async function drain() {
    let total = { done: 0 };
    for (let i = 0; i < 6; i += 1) {
      const result = await saga.runDue();
      total = { done: total.done + result.done };
      if (result.claimed === 0) break;
    }
    return total;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.JWT_PUBLIC_KEY = 'integration-test-public-key-not-a-secret-000000';
    process.env.DATING_CRON_ENABLED = 'false';
    delete process.env.PORT;
    ({ db } = await import('./db.js'));
    const { ReservationSagaService } = await import('./reservation.service.js');
    partners = new FakePartners();
    payments = new FakePayments();
    saga = new ReservationSagaService(() => clock, partners, payments);
  });

  afterAll(async () => {
    await db?.deleteFrom('dating_profiles').where('user_id', 'in', profileIds).execute();
    await db?.destroy();
  });

  it('chemin nominal : retenue, paiement, table confirmée, date confirmé', async () => {
    const dateId = await makeDate(1);
    await saga.start(dateId, SLOT, VENUE);
    await drain();
    expect((await saga.get(dateId))?.state).toBe('awaiting_payment');

    await saga.handleEnvelope(
      buildEvent({
        type: 'payment.escrowed',
        producer: 'payments',
        payload: { payment_id: PAY1, object_type: 'date', object_id: dateId },
      }),
    );
    await drain();
    expect((await saga.get(dateId))?.state).toBe('confirmed');
    expect(partners.calls).toContain(`confirm:${dateId}:1`);
    const row = await db
      .selectFrom('dates')
      .select('status')
      .where('id', '=', dateId)
      .executeTakeFirstOrThrow();
    expect(row.status).toBe('confirmed');
  });

  it('créneau perdu : saga en échec SLOT_LOST, aucun paiement à rendre', async () => {
    partners.holdResult = { status: 'rejected', reason: 'SLOT_FULL' };
    const dateId = await makeDate(2);
    await saga.start(dateId, SLOT, VENUE);
    await drain();
    expect(await saga.get(dateId)).toMatchObject({ state: 'failed', failure_reason: 'SLOT_LOST' });
    partners.holdResult = {
      status: 'held',
      expires_at: '2026-11-09T10:15:00.000Z',
      starts_at: '2026-11-16T16:00:00.000Z',
    };
  });

  it('paiement refusé : la table est libérée, puis une nouvelle tentative repart', async () => {
    const dateId = await makeDate(3);
    await saga.start(dateId, SLOT, VENUE);
    await drain();
    await saga.handleEnvelope(
      buildEvent({
        type: 'payment.failed',
        producer: 'payments',
        payload: { payment_id: PAY1, object_type: 'date', object_id: dateId },
      }),
    );
    await drain();
    expect(await saga.get(dateId)).toMatchObject({
      state: 'failed',
      failure_reason: 'PAYMENT_FAILED',
    });
    expect(partners.calls).toContain(`release:${dateId}:1`);

    await saga.start(dateId, SLOT, VENUE);
    await drain();
    expect(await saga.get(dateId)).toMatchObject({ state: 'awaiting_payment', attempt: 2 });
    expect(partners.calls).toContain(`hold:${dateId}:2`);
  });

  it('retenue expirée puis argent tardif : remboursé une seule fois', async () => {
    const dateId = await makeDate(4);
    await saga.start(dateId, SLOT, VENUE);
    await drain();
    const expired = buildEvent({
      type: 'slot.released',
      producer: 'partners',
      payload: { hold_ref: `${dateId}:1`, slot_id: SLOT, venue_id: VENUE, reason: 'expired' },
    });
    expect((await saga.handleEnvelope(expired)).outcome).toBe('applied');
    const late = buildEvent({
      type: 'payment.escrowed',
      producer: 'payments',
      payload: { payment_id: PAY2, object_type: 'date', object_id: dateId },
    });
    await saga.handleEnvelope(late);
    await saga.handleEnvelope(late); // rejeu
    await drain();
    expect(payments.refunds.filter((id) => id === PAY2)).toHaveLength(1);
    expect((await saga.get(dateId))?.state).toBe('failed');
  });

  it('un slot.released d’une tentative précédente est ignoré', async () => {
    const dateId = dateIds[2]!; // tentative 2 en cours (date 3)
    const stale = buildEvent({
      type: 'slot.released',
      producer: 'partners',
      payload: { hold_ref: `${dateId}:1`, slot_id: SLOT, venue_id: VENUE, reason: 'expired' },
    });
    expect((await saga.handleEnvelope(stale)).outcome).toBe('stale');
    expect((await saga.get(dateId))?.state).toBe('awaiting_payment');
  });

  it('crash en cours de route : l’action reste due et reprend sans doublon', async () => {
    const dateId = await makeDate(5);
    partners.failNext = 1;
    await saga.start(dateId, SLOT, VENUE);
    const first = await saga.runDue();
    expect(first.failed).toBe(1);
    expect((await saga.get(dateId))?.state).toBe('holding');

    // L'action est repoussée avec un délai : l'horloge avance.
    clock = new Date(clock.getTime() + 20 * 60_000);
    await drain();
    expect((await saga.get(dateId))?.state).toBe('awaiting_payment');
    expect(partners.calls.filter((call) => call === `hold:${dateId}:1`)).toHaveLength(1);
  });

  it('table perdue à la confirmation : l’argent est rendu', async () => {
    const dateId = await makeDate(6);
    await saga.start(dateId, SLOT, VENUE);
    await drain();
    partners.confirmResult = 'expired';
    await saga.handleEnvelope(
      buildEvent({
        type: 'payment.escrowed',
        producer: 'payments',
        payload: { payment_id: PAY1, object_type: 'date', object_id: dateId },
      }),
    );
    await drain();
    partners.confirmResult = 'confirmed';
    expect((await saga.get(dateId))?.state).toBe('failed');
    expect(payments.refunds).toContain(PAY1);
  });

  it('événements simultanés : une seule confirmation de table', async () => {
    const dateId = await makeDate(7);
    await saga.start(dateId, SLOT, VENUE);
    await drain();
    const event = buildEvent({
      type: 'payment.escrowed',
      producer: 'payments',
      payload: { payment_id: PAY2, object_type: 'date', object_id: dateId },
    });
    await Promise.all(Array.from({ length: 6 }, () => saga.handleEnvelope(event)));
    await drain();
    expect(partners.calls.filter((call) => call === `confirm:${dateId}:1`)).toHaveLength(1);
    expect((await saga.get(dateId))?.state).toBe('confirmed');
  });

  it('annulation d’un date confirmé : table libérée et paiement remboursé', async () => {
    const dateId = dateIds[0]!; // date 1 confirmé
    const before = payments.refunds.length;
    await saga.dispatch(dateId, { type: 'cancel_requested' });
    await drain();
    expect((await saga.get(dateId))?.state).toBe('cancelled');
    expect(partners.calls).toContain(`release:${dateId}:1`);
    expect(payments.refunds.slice(before)).toEqual([PAY1]);
  });
});
