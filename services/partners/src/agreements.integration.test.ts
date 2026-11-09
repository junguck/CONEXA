import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { JwtClaims } from '@conexa/contracts';

/**
 * Test d'intégration opt-in (voir holds.integration.test.ts) :
 *   PARTNERS_TEST_DATABASE_URL=postgres://… pnpm --filter @conexa/partners test
 */
const TEST_DATABASE_URL = process.env.PARTNERS_TEST_DATABASE_URL;
const ORG = '31111111-1111-4111-8111-111111111111';
const VENUE = '32222222-2222-4222-8222-222222222222';
const OWNER = '34444444-4444-4444-8444-444444444444';

describe.skipIf(!TEST_DATABASE_URL)('contrats partenaires sur PostgreSQL', () => {
  let db: typeof import('./db.js').db;
  let agreements: import('./agreements.service.js').AgreementsService;
  const owner = { sub: OWNER, roles: ['partner_staff'] } as unknown as JwtClaims;
  const stranger = {
    sub: '35555555-5555-4555-8555-555555555555',
    roles: ['partner_staff'],
  } as unknown as JwtClaims;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.JWT_PUBLIC_KEY = 'integration-test-public-key-not-a-secret-000000';
    process.env.PARTNERS_CRON_ENABLED = 'false';
    delete process.env.PORT;
    ({ db } = await import('./db.js'));
    const { AgreementsService } = await import('./agreements.service.js');
    agreements = new AgreementsService();

    await db.deleteFrom('organisations').where('id', '=', ORG).execute();
    await db
      .insertInto('organisations')
      .values({
        id: ORG,
        owner_user_id: OWNER,
        name: 'Contrats',
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
  });

  afterAll(async () => {
    await db?.deleteFrom('organisations').where('id', '=', ORG).execute();
    await db?.destroy();
  });

  it('sans contrat actif, la saga ne reçoit pas de commission', async () => {
    await expect(agreements.commissionForVenue(VENUE)).rejects.toThrow();
  });

  it('proposition puis signature : un seul contrat actif, version 1', async () => {
    const proposed = await agreements.propose(ORG, { commission_pct: 10 });
    expect(proposed).toMatchObject({ version: 1, status: 'pending_signature' });
    const signed = await agreements.sign(owner, proposed.id);
    expect(signed).toMatchObject({ version: 1, status: 'active' });
    expect(await agreements.commissionForVenue(VENUE)).toMatchObject({
      version: 1,
      commission_pct: 10,
    });
  });

  it('une seconde proposition en attente est refusée', async () => {
    await agreements.propose(ORG, { commission_pct: 12 });
    await expect(agreements.propose(ORG, { commission_pct: 15 })).rejects.toThrow();
  });

  it('un autre partenaire ne peut pas signer', async () => {
    const pending = (await agreements.list(owner, ORG)).find(
      (item) => item.status === 'pending_signature',
    )!;
    await expect(agreements.sign(stranger, pending.id)).rejects.toThrow();
  });

  it('signatures simultanées : un seul actif, l’ancien est remplacé', async () => {
    const pending = (await agreements.list(owner, ORG)).find(
      (item) => item.status === 'pending_signature',
    )!;
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => agreements.sign(owner, pending.id)),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const all = await agreements.list(owner, ORG);
    expect(all.filter((item) => item.status === 'active')).toHaveLength(1);
    expect(all.find((item) => item.status === 'active')).toMatchObject({
      version: 2,
      commission_pct: 12,
    });
    expect(all.find((item) => item.version === 1)?.status).toBe('superseded');
  });

  it('la base refuse deux contrats actifs, même par écriture directe', async () => {
    await expect(
      db
        .insertInto('agreements')
        .values({
          id: '36666666-6666-4666-8666-666666666666',
          organisation_id: ORG,
          version: 99,
          commission_pct: 5,
          status: 'active',
          signed_at: new Date(),
        })
        .execute(),
    ).rejects.toThrow();
  });

  it('la commission lue pour une réservation suit le contrat actif', async () => {
    expect(await agreements.commissionForVenue(VENUE)).toMatchObject({
      version: 2,
      commission_pct: 12,
    });
  });
});
