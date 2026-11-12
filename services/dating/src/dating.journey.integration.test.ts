import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildEvent } from '@conexa/events';

import type { HoldOutcome, PartnersPort, PaymentsPort } from './reservation.ports.js';

/**
 * Parcours complet d'un couple, sur l'API locale et un vrai PostgreSQL :
 * invitation → date → créneau Partners (retenue) → paiement (séquestre simulé
 * par un événement) → check-in des deux → contact révélé → retour.
 *
 *   DATING_TEST_DATABASE_URL=postgres://…  pnpm --filter @conexa/dating test
 *
 * Partners et Payments sont des doublures : aucun numéro réel, aucun montant réel.
 * Le contact renvoyé par Identity est une valeur de test, jamais un numéro.
 */
const TEST_DATABASE_URL = process.env.DATING_TEST_DATABASE_URL;
const TEST_CONTACT = 'contact-de-test-non-un-numero';

const A = 'a0000001-0000-4000-8000-000000000001';
const B = 'b0000001-0000-4000-8000-000000000002';
const SLOT = '51000001-0000-4000-8000-000000000003';
const VENUE = '7e000001-0000-4000-8000-000000000004';
const PAYMENT = '9a000001-0000-4000-8000-000000000005';
// Lundi de la semaine ISO de l'horloge de test (jeudi 12/11/2026).
const WEEK = '2026-11-09';

class FakePartners implements PartnersPort {
  holdCalls = 0;
  async hold(): Promise<HoldOutcome> {
    this.holdCalls += 1;
    return {
      status: 'held',
      expires_at: '2026-11-16T15:15:00.000Z',
      starts_at: '2026-11-16T15:00:00.000Z',
    };
  }
  async confirm() {
    return { status: 'confirmed' };
  }
  async release() {
    return { status: 'released' };
  }
}

class FakePayments implements PaymentsPort {
  refunds: string[] = [];
  async refund(paymentId: string) {
    this.refunds.push(paymentId);
  }
}

const ANSWERS = {
  values_priority: 'family',
  values_conflict: 'talk_now',
  values_weekend: 'friends',
  values_trust: 4,
  personality_energy: 'close_ones',
  personality_humour: 'wordplay',
  personality_speaking: 3,
  personality_spontaneity: 2,
  lifestyle_rhythm: 'early_bird',
  lifestyle_study: 'sport',
  lifestyle_budget: 3,
  lifestyle_smoking: 'never',
} as const;

describe.skipIf(!TEST_DATABASE_URL)('parcours d’un couple, de l’invitation au retour', () => {
  let db: typeof import('./db.js').db;
  let dating: import('./dating.service.js').DatingService;
  let dates: import('./dates.service.js').DatesService;
  let saga: import('./reservation.service.js').ReservationSagaService;
  let partners: FakePartners;
  const clock = () => new Date('2026-11-12T10:00:00Z');

  async function drain(): Promise<void> {
    for (let round = 0; round < 6; round += 1) {
      const result = await saga.runDue();
      if (result.claimed === 0) return;
    }
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.JWT_PUBLIC_KEY = 'integration-test-public-key-not-a-secret-000000';
    process.env.DATING_CRON_ENABLED = 'false';
    process.env.IDENTITY_URL = 'http://identity.test';
    process.env.SERVICE_TOKEN = 'integration-service-token-0000';
    delete process.env.PORT;

    // Identity est une doublure : aucun numéro réel ne circule dans ce test.
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ whatsapp: TEST_CONTACT }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;

    ({ db } = await import('./db.js'));
    const { DatingService } = await import('./dating.service.js');
    const { DatesService } = await import('./dates.service.js');
    const { DatingOutboxService } = await import('./outbox.service.js');
    const { ReservationSagaService } = await import('./reservation.service.js');

    const outbox = new DatingOutboxService(clock, { publish: async () => undefined });
    dating = new DatingService(clock, outbox);
    partners = new FakePartners();
    saga = new ReservationSagaService(clock, partners, new FakePayments());
    dates = new DatesService(clock, saga);

    await db
      .deleteFrom('dates')
      .where((eb) => eb.or([eb('user_a', 'in', [A, B]), eb('user_b', 'in', [A, B])]))
      .execute();
    await db.deleteFrom('invites').where('from_user_id', '=', A).execute();
    await db.deleteFrom('weekly_picks').where('user_id', '=', A).execute();
    await db.deleteFrom('dating_profiles').where('user_id', 'in', [A, B]).execute();
    await db.deleteFrom('dating_outbox').execute();
  });

  afterAll(async () => {
    if (!db) return;
    await db
      .deleteFrom('dates')
      .where((eb) => eb.or([eb('user_a', 'in', [A, B]), eb('user_b', 'in', [A, B])]))
      .execute();
    await db.deleteFrom('invites').where('from_user_id', '=', A).execute();
    await db.deleteFrom('weekly_picks').where('user_id', '=', A).execute();
    await db.deleteFrom('dating_profiles').where('user_id', 'in', [A, B]).execute();
    await db.deleteFrom('dating_outbox').execute();
    await db.destroy();
  });

  it('va de l’invitation au retour, contact révélé seulement après les deux check-ins', async () => {
    // 1. Deux profils éligibles.
    await dating.putProfile(A, {
      birth_date: '2003-05-12',
      questionnaire_v: 1,
      answers: { ...ANSWERS },
      seeking: ['female'],
      age_min: 18,
      age_max: 30,
    });
    await dating.putProfile(B, {
      birth_date: '2004-02-20',
      questionnaire_v: 1,
      answers: { ...ANSWERS },
      seeking: ['male'],
      age_min: 18,
      age_max: 30,
    });
    await db
      .updateTable('dating_profiles')
      .set({ gender: 'male' })
      .where('user_id', '=', A)
      .execute();
    await db
      .updateTable('dating_profiles')
      .set({ gender: 'female' })
      .where('user_id', '=', B)
      .execute();

    // La demande d'embedding part dans l'outbox, sans aucune donnée personnelle.
    const outboxRows = await db.selectFrom('dating_outbox').select(['envelope']).execute();
    expect(outboxRows.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(outboxRows.map((row) => row.envelope));
    expect(serialized).not.toContain(TEST_CONTACT);
    expect(serialized).not.toContain('whatsapp');
    expect(serialized).not.toContain('+237');
    expect(serialized).toContain('dating.embedding_requested');

    // 2. Proposition puis invitation : l'invitant paie.
    const pick = await db
      .insertInto('weekly_picks')
      .values({
        user_id: A,
        candidate_id: B,
        week_start: WEEK,
        kind: 'similar',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const invite = await dating.inviteFromPick(A, pick.id);

    // 3. Acceptation : le date est créé avec le payeur figé.
    const { date_id } = await dating.acceptInvite(B, invite.id);
    const created = await dates.get(A, date_id);
    expect(created.payer_id).toBe(A);
    expect(created.i_am_payer).toBe(true);

    // 4. Choix du créneau : la saga retient chez Partners.
    const locked = await dates.setSlot(A, date_id, SLOT, VENUE);
    expect(locked.slot_id).toBe(SLOT);
    expect(locked.restaurant_id).toBe(VENUE);
    expect(partners.holdCalls).toBe(1);

    // 5. Paiement : la saga attend le séquestre, elle ne confirme rien seule.
    const intent = await dates.pay(A, date_id);
    expect(intent.status).toBe('awaiting_payment');
    expect((await dates.get(A, date_id)).status).toBe('negotiating');

    // 6. Le séquestre arrive par le bus : la table et le date sont confirmés.
    await saga.handleEnvelope(
      buildEvent({
        type: 'payment.escrowed',
        producer: 'payments',
        payload: { payment_id: PAYMENT, object_type: 'date', object_id: date_id },
      }),
    );
    await drain();
    expect((await dates.get(A, date_id)).status).toBe('confirmed');

    // 7. Avant tout check-in, le contact reste fermé.
    await expect(dates.contact(B, date_id)).rejects.toMatchObject({
      code: 'CONTACT_NOT_REVEALED',
    });

    // 8. Un seul check-in ne révèle rien (décision 15B).
    const code = await db
      .selectFrom('dates')
      .select('checkin_code')
      .where('id', '=', date_id)
      .executeTakeFirstOrThrow();
    await dates.checkin(A, date_id, code.checkin_code);
    await expect(dates.contact(A, date_id)).rejects.toMatchObject({
      code: 'CONTACT_NOT_REVEALED',
    });

    // 9. Le second check-in révèle le contact aux deux.
    const afterBoth = await dates.checkin(B, date_id, code.checkin_code);
    expect(afterBoth.status).toBe('checked_in');
    await expect(dates.contact(A, date_id)).resolves.toEqual({ whatsapp: TEST_CONTACT });
    await expect(dates.contact(B, date_id)).resolves.toEqual({ whatsapp: TEST_CONTACT });

    // 10. Le retour reste privé et clôt le date ; il ne conditionne pas la révélation.
    const criteria = { conversation: 4, values: 4, attraction: 3, punctuality: 5 };
    await dates.feedback(A, date_id, { wants_contact: false, criteria });
    await dates.feedback(B, date_id, { wants_contact: false, criteria });
    expect((await dates.get(A, date_id)).status).toBe('completed');
    await expect(dates.contact(A, date_id)).resolves.toEqual({ whatsapp: TEST_CONTACT });
  });

  it('un no-show ne révèle jamais le contact, même avec deux check-ins enregistrés', async () => {
    const { date_id } = await dating.acceptInvite(
      B,
      (
        await db
          .insertInto('invites')
          .values({ from_user_id: A, to_user_id: B, week_start: WEEK })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id,
    );
    await db
      .updateTable('dates')
      .set({
        status: 'no_show',
        checked_in_a_at: new Date('2026-11-16T15:01:00Z'),
        checked_in_b_at: new Date('2026-11-16T15:02:00Z'),
      })
      .where('id', '=', date_id)
      .execute();

    await expect(dates.contact(A, date_id)).rejects.toMatchObject({
      code: 'CONTACT_NOT_REVEALED',
    });
  });

  it('refuse l’annulation à moins de 3 h de la retenue', async () => {
    const invite = await db
      .insertInto('invites')
      .values({ from_user_id: A, to_user_id: B, week_start: WEEK })
      .returning('id')
      .executeTakeFirstOrThrow();
    const { date_id } = await dating.acceptInvite(B, invite.id);
    await dates.setSlot(A, date_id, SLOT, VENUE);

    // Le créneau de test démarre le 2026-11-16 à 15:00 UTC : à 13:30, il reste
    // moins de 3 h, l'annulation est fermée.
    const lateClock = () => new Date('2026-11-16T13:30:00Z');
    const { DatesService } = await import('./dates.service.js');
    const lateDates = new DatesService(lateClock, saga);
    await expect(lateDates.cancel(A, date_id)).rejects.toMatchObject({
      code: 'CANCEL_WINDOW_CLOSED',
    });
    expect((await dates.get(A, date_id)).status).not.toBe('cancelled');
  });
});
