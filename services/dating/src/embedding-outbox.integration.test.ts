import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { QUESTIONNAIRE_BLOCKS } from '@conexa/contracts';
import type { EventEnvelope, EventPublisher } from '@conexa/events';

/**
 * Test d'intégration opt-in : il exige une base PostgreSQL dédiée, migrée
 * (`pnpm db:migrate dating`) et vide de données réelles.
 *
 *   DATING_TEST_DATABASE_URL=postgres://postgres@localhost:5432/conexa_dating_test \
 *     pnpm --filter @conexa/dating test
 *
 * Sans cette variable, le test est ignoré : la CI sans PostgreSQL reste verte.
 */
const TEST_DATABASE_URL = process.env.DATING_TEST_DATABASE_URL;
const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-26T09:00:00Z');

const ANSWERS = Object.fromEntries(
  QUESTIONNAIRE_BLOCKS.flatMap((block) =>
    block.questions.map((question) => [
      question.key,
      question.kind === 'scale' ? 3 : (question.options?.[0] as string),
    ]),
  ),
) as Record<string, string | number>;

const INPUT = {
  birth_date: '2004-05-12',
  questionnaire_v: 1,
  answers: ANSWERS,
  seeking: ['female' as const],
  age_min: 18,
  age_max: 30,
};

describe.skipIf(!TEST_DATABASE_URL)('outbox transactionnelle de dating', () => {
  let db: typeof import('./db.js').db;
  let DatingService: typeof import('./dating.service.js').DatingService;
  let DatingOutboxService: typeof import('./outbox.service.js').DatingOutboxService;
  let buildEmbeddingRequestedEvent: typeof import('./embedding-request.js').buildEmbeddingRequestedEvent;

  const busCalls: Array<Array<Record<string, unknown>>> = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.JWT_PUBLIC_KEY = 'integration-test-public-key-not-a-secret-000000';
    process.env.DATING_CRON_ENABLED = 'false';
    // L'environnement de l'agent peut fournir PORT=0, refusé par le kit.
    delete process.env.PORT;
    ({ db } = await import('./db.js'));
    ({ DatingService } = await import('./dating.service.js'));
    ({ DatingOutboxService } = await import('./outbox.service.js'));
    ({ buildEmbeddingRequestedEvent } = await import('./embedding-request.js'));

    await db.deleteFrom('dating_outbox').execute();
    await db.deleteFrom('dating_profiles').where('user_id', '=', USER_ID).execute();
  });

  afterAll(async () => {
    if (!db) {
      return;
    }
    await db.deleteFrom('dating_outbox').execute();
    await db.deleteFrom('dating_profiles').where('user_id', '=', USER_ID).execute();
    await db.destroy();
  });

  it('annule le profil et l’outbox dans la même transaction', async () => {
    const clock = () => NOW;
    const outbox = new DatingOutboxService(clock, {
      publish: async () => {
        throw new Error('pas encore branché');
      },
    } as unknown as EventPublisher);
    const event = buildEmbeddingRequestedEvent({
      userId: USER_ID,
      profileId: USER_ID,
      questionnaireVersion: 1,
      answers: ANSWERS,
      occurredAt: NOW,
      eventId: '6f1c5f2e-3f0e-4a5a-9b4a-2f2f0c1d9a11',
    });

    await expect(
      db.transaction().execute(async (trx) => {
        await trx
          .insertInto('dating_profiles')
          .values({
            user_id: USER_ID,
            birth_date: new Date('2004-05-12T00:00:00Z'),
            questionnaire_v: 1,
            answers: ANSWERS,
            seeking: ['female'],
            age_min: 18,
            age_max: 30,
          })
          .execute();
        await outbox.enqueue(trx, event as unknown as EventEnvelope);
        throw new Error('rollback volontaire');
      }),
    ).rejects.toThrow('rollback volontaire');

    const profile = await db
      .selectFrom('dating_profiles')
      .select('user_id')
      .where('user_id', '=', USER_ID)
      .executeTakeFirst();
    const outboxRow = await db
      .selectFrom('dating_outbox')
      .select('id')
      .where('id', '=', event.id)
      .executeTakeFirst();

    expect(profile).toBeUndefined();
    expect(outboxRow).toBeUndefined();
  });

  it('n’émet qu’un événement par changement et relaie par lot avec le même id', async () => {
    const clock = () => NOW;
    const bus: EventPublisher = {
      publish: async (envelopes) => {
        busCalls.push([...envelopes] as unknown as Array<Record<string, unknown>>);
        throw new Error('bus indisponible');
      },
    };
    const outbox = new DatingOutboxService(clock, bus);
    const service = new DatingService(clock, outbox);

    await service.putProfile(USER_ID, INPUT);
    const first = await db
      .selectFrom('dating_outbox')
      .selectAll()
      .where('status', '=', 'pending')
      .execute();
    expect(first).toHaveLength(1);

    // Même écriture : aucune nouvelle demande d'embedding.
    await service.putProfile(USER_ID, INPUT);
    expect(await db.selectFrom('dating_outbox').select('id').execute()).toHaveLength(1);

    // Réponses modifiées : une seconde demande.
    await service.putProfile(USER_ID, { ...INPUT, answers: { ...ANSWERS, values_trust: 5 } });
    const rows = await db
      .selectFrom('dating_outbox')
      .selectAll()
      .orderBy('created_at', 'asc')
      .execute();
    expect(rows).toHaveLength(2);

    // Bus indisponible : le lot est repoussé, résultat métier intact.
    let outcome = await outbox.relay();
    expect(outcome).toEqual({ examined: 2, changed: 0, failed: 2 });
    const afterFailure = await db
      .selectFrom('dating_outbox')
      .select(['id', 'attempts', 'status', 'last_error'])
      .where('id', '=', rows[0]!.id)
      .executeTakeFirstOrThrow();
    expect(afterFailure.attempts).toBe(1);
    expect(afterFailure.status).toBe('pending');
    expect(afterFailure.last_error).toContain('bus indisponible');

    // Bus sain : publication par lot (un appel), reprise et marquage publié.
    busCalls.length = 0;
    const healthyBus: EventPublisher = {
      publish: async (envelopes) => {
        busCalls.push([...envelopes] as unknown as Array<Record<string, unknown>>);
      },
    };
    const recovering = new DatingOutboxService(clock, healthyBus);
    await db.updateTable('dating_outbox').set({ available_at: NOW }).execute();
    outcome = await recovering.relay();
    expect(outcome).toEqual({ examined: 2, changed: 2, failed: 0 });
    expect(busCalls).toHaveLength(1);
    expect(busCalls[0]).toHaveLength(2);
    expect(
      await db
        .selectFrom('dating_outbox')
        .select('status')
        .where('id', '=', rows[0]!.id)
        .executeTakeFirstOrThrow(),
    ).toBe('published');

    // La première enveloppe publiée porte les données du profil.
    const firstEvent = (
      busCalls[0] as Array<{ id: string; payload: Record<string, unknown> }>
    ).find((candidate) => candidate.id === rows[0]!.id)!;
    expect(firstEvent.payload).toMatchObject({
      user_id: USER_ID,
      profile_id: USER_ID,
      questionnaire_version: 1,
    });
  });
});
