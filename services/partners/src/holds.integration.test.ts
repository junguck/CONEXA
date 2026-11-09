import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { EventEnvelope, EventPublisher } from '@conexa/events';

/**
 * Test d'intégration opt-in : base PostgreSQL dédiée, migrée
 * (`pnpm db:migrate partners`) et vide de données réelles.
 *
 *   PARTNERS_TEST_DATABASE_URL=postgres://postgres@localhost:5432/conexa_partners_test \
 *     pnpm --filter @conexa/partners test
 *
 * Sans cette variable, le test est ignoré : la CI sans PostgreSQL reste verte.
 */
const TEST_DATABASE_URL = process.env.PARTNERS_TEST_DATABASE_URL;
const ORG = '21111111-1111-4111-8111-111111111111';
const VENUE = '22222222-2222-4222-8222-222222222222';
const SLOT = '23333333-3333-4333-8333-333333333333';

describe.skipIf(!TEST_DATABASE_URL)('retenue de créneau sur PostgreSQL', () => {
  let db: typeof import('./db.js').db;
  let holds: import('./holds.service.js').SlotHoldsService;
  let outbox: import('./outbox.service.js').PartnersOutboxService;
  let clock = new Date('2026-11-09T10:00:00Z');
  const published: EventEnvelope[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.JWT_PUBLIC_KEY = 'integration-test-public-key-not-a-secret-000000';
    process.env.PARTNERS_CRON_ENABLED = 'false';
    delete process.env.PORT;
    ({ db } = await import('./db.js'));
    const { PartnersOutboxService } = await import('./outbox.service.js');
    const { SlotHoldsService } = await import('./holds.service.js');
    const bus: EventPublisher = {
      publish: async (batch: EventEnvelope[]) => {
        published.push(...batch);
      },
    } as EventPublisher;
    outbox = new PartnersOutboxService(() => clock, bus);
    holds = new SlotHoldsService(() => clock, outbox);

    // Nettoyage limité à nos lignes : d'autres tests partagent la base.
    await db.deleteFrom('organisations').where('id', '=', ORG).execute();
    await db.deleteFrom('partners_outbox').execute();
    await db
      .insertInto('organisations')
      .values({
        id: ORG,
        owner_user_id: '24444444-4444-4444-8444-444444444444',
        name: 'Test',
        kind: 'restaurant',
        city: 'yaounde',
        contact_whatsapp: 'x',
        status: 'active',
        commission_pct: 10,
      })
      .execute();
    await db
      .insertInto('venues')
      .values({
        id: VENUE,
        organisation_id: ORG,
        name: 'Lieu',
        kind: 'restaurant',
        city: 'yaounde',
        address: 'x',
        capacity: 10,
        price_per_hour_fcfa: null,
        status: 'active',
      })
      .execute();
    await db
      .insertInto('slots')
      .values({
        id: SLOT,
        venue_id: VENUE,
        starts_at: new Date('2026-11-09T18:00:00Z'),
        ends_at: new Date('2026-11-09T20:00:00Z'),
        capacity: 1,
        price_fcfa: null,
        status: 'open',
      })
      .execute();
  });

  afterAll(async () => {
    await db?.destroy();
  });

  it('dernière table : sous concurrence, une seule retenue passe', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) => holds.hold(SLOT, `date-race-${index}`)),
    );
    expect(results.filter((result) => result.status === 'held')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(7);
  });

  it('rejouer la même réservation ne crée pas de seconde retenue', async () => {
    const winner = (await db.selectFrom('slot_holds').selectAll().execute())[0]!;
    const again = await holds.hold(SLOT, winner.hold_ref);
    expect(again.status).toBe('held');
    expect(await db.selectFrom('slot_holds').selectAll().execute()).toHaveLength(1);
  });

  it('une retenue échue est libérée par le balayage, une seule fois', async () => {
    clock = new Date('2026-11-09T10:15:01Z');
    const first = await holds.sweepExpired();
    const second = await holds.sweepExpired();
    expect(first.changed).toBe(1);
    expect(second.changed).toBe(0);
    const released = (await db.selectFrom('partners_outbox').selectAll().execute()).filter(
      (row) => (row.envelope as EventEnvelope).type === 'slot.released',
    );
    expect(released).toHaveLength(1);
  });

  it('la place libérée peut être retenue de nouveau', async () => {
    const result = await holds.hold(SLOT, 'date-after-expiry');
    expect(result.status).toBe('held');
  });

  it('libération explicite puis confirmation refusée', async () => {
    expect((await holds.release('date-after-expiry')).status).toBe('released');
    expect((await holds.release('date-after-expiry')).status).toBe('released');
    expect((await holds.confirm('date-after-expiry')).status).toBe('released');
  });

  it('le relais publie par lot, sans donnée personnelle, et ne republie pas', async () => {
    const first = await outbox.relay();
    expect(first.changed).toBeGreaterThan(0);
    expect(published.every((event) => event.producer === 'partners')).toBe(true);
    expect(JSON.stringify(published)).not.toMatch(/whatsapp|matricule|phone/i);
    const second = await outbox.relay();
    expect(second.examined).toBe(0);
  });
});
