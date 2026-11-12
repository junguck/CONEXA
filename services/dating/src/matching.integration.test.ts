import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { QUESTIONNAIRE_BLOCKS } from '@conexa/contracts';
import type { EventPublisher } from '@conexa/events';
import { buildEvent } from '@conexa/events';

/**
 * Test d'intégration opt-in (voir embedding-outbox.integration.test.ts) :
 *   DATING_TEST_DATABASE_URL=postgres://… pnpm --filter @conexa/dating test
 */
const TEST_DATABASE_URL = process.env.DATING_TEST_DATABASE_URL;
const NOW = new Date('2026-11-09T09:00:00Z');
const id = (n: number) => `4${n.toString().padStart(7, '0')}-0000-4000-8000-000000000000`;
const ME = id(1);
const ME_Q = id(9);
const [A, B, C, D] = [id(2), id(3), id(4), id(5)];

const ANSWERS = Object.fromEntries(
  QUESTIONNAIRE_BLOCKS.flatMap((block) =>
    block.questions.map((question) => [
      question.key,
      question.kind === 'scale' ? 3 : (question.options?.[0] as string),
    ]),
  ),
) as Record<string, string | number>;

const unit = (axis: number): number[] =>
  Array.from({ length: 64 }, (_, index) => (index === axis ? 1 : 0));
const mix = (a: number, b: number): number[] =>
  Array.from({ length: 64 }, (_, index) => (index === a || index === b ? 1 : 0));
const vec = (v: number[], p: number[], l: number[]) => ({
  values: v,
  personality: p,
  lifestyle: l,
});

function computed(
  userId: string,
  version: number,
  vectors: ReturnType<typeof vec>,
  eventId?: string,
) {
  return buildEvent({
    ...(eventId ? { id: eventId } : {}),
    type: 'embedding.computed',
    producer: 'ai',
    payload: {
      user_id: userId,
      profile_id: userId,
      questionnaire_version: version,
      model_version: 'dating-qhash-v1',
      dimension: 64,
      vectors,
    },
    occurredAt: NOW,
  });
}

describe.skipIf(!TEST_DATABASE_URL)('vecteurs et propositions sur PostgreSQL', () => {
  let db: typeof import('./db.js').db;
  let consumer: import('./embeddings.consumer.js').EmbeddingsConsumer;
  let service: import('./dating.service.js').DatingService;
  const ids = [ME, ME_Q, A, B, C, D];

  async function makeUser(userId: string) {
    await db
      .insertInto('dating_profiles')
      .values({
        user_id: userId,
        birth_date: new Date('2003-05-12T00:00:00Z'),
        gender: 'female',
        questionnaire_v: 1,
        answers: ANSWERS,
        seeking: ['female'],
        age_min: 18,
        age_max: 35,
      })
      .execute();
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.JWT_PUBLIC_KEY = 'integration-test-public-key-not-a-secret-000000';
    process.env.DATING_CRON_ENABLED = 'false';
    delete process.env.PORT;
    ({ db } = await import('./db.js'));
    const { EmbeddingsConsumer } = await import('./embeddings.consumer.js');
    const { DatingService } = await import('./dating.service.js');
    const { DatingOutboxService } = await import('./outbox.service.js');
    consumer = new EmbeddingsConsumer();
    service = new DatingService(
      () => NOW,
      new DatingOutboxService(() => NOW, { publish: async () => {} } as unknown as EventPublisher),
    );
    await db.deleteFrom('dating_inbox').where('consumer', '=', 'dating.embeddings').execute();
    await db.deleteFrom('dating_profiles').where('user_id', 'in', ids).execute();
    for (const userId of ids) await makeUser(userId);
  });

  afterAll(async () => {
    await db?.deleteFrom('dating_inbox').where('consumer', '=', 'dating.embeddings').execute();
    await db?.deleteFrom('dating_profiles').where('user_id', 'in', ids).execute();
    await db?.destroy();
  });

  it('stocke les vecteurs reçus, puis ignore le rejeu du même événement', async () => {
    const me = vec(unit(0), unit(1), unit(2));
    const event = computed(ME, 1, me, '5aaaaaaa-0000-4000-8000-000000000001');
    expect(await consumer.handle(event)).toEqual({ outcome: 'stored' });
    expect(await consumer.handle(event)).toEqual({ outcome: 'duplicate' });
    const rows = await db
      .selectFrom('profile_vectors')
      .selectAll()
      .where('user_id', '=', ME)
      .execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.values_vec).toHaveLength(64);
  });

  it('ignore un résultat périmé et un profil inconnu, refuse un vecteur invalide', async () => {
    expect(await consumer.handle(computed(id(77), 1, vec(unit(0), unit(1), unit(2))))).toEqual({
      outcome: 'unknown_profile',
    });
    await db
      .updateTable('dating_profiles')
      .set({ questionnaire_v: 2 })
      .where('user_id', '=', ME_Q)
      .execute();
    expect(await consumer.handle(computed(ME_Q, 1, vec(unit(0), unit(1), unit(2))))).toEqual({
      outcome: 'stale',
    });
    const bad = computed(A, 1, vec(unit(0), [1, 2, 3], unit(2)));
    await expect(consumer.handle(bad)).rejects.toThrow();
    expect(
      await db
        .selectFrom('profile_vectors')
        .select('user_id')
        .where('user_id', '=', ME_Q)
        .execute(),
    ).toHaveLength(0);
  });

  it('classe les propositions par cosinus : deux ressemblants puis un complémentaire', async () => {
    await consumer.handle(computed(A, 1, vec(unit(0), unit(1), unit(2))));
    await consumer.handle(computed(B, 1, vec(unit(0), unit(7), unit(2))));
    await consumer.handle(computed(C, 1, vec(mix(0, 3), unit(9), unit(8))));
    await consumer.handle(computed(D, 1, vec(unit(10), unit(11), unit(12))));

    const result = await service.currentPicks(ME);
    expect(result.picks.map((pick) => [pick.candidate_id, pick.kind])).toEqual([
      [A, 'similar'],
      [B, 'similar'],
      [C, 'complementary'],
    ]);
  });

  it('les propositions restent stables pour la semaine', async () => {
    const again = await service.currentPicks(ME);
    expect(again.picks.map((pick) => pick.candidate_id)).toEqual([A, B, C]);
  });

  it('quarantaine : un refus de moins de 60 jours écarte la personne', async () => {
    await db
      .insertInto('invites')
      .values([
        // A a refusé mon invitation il y a 10 jours.
        {
          from_user_id: ME_Q,
          to_user_id: A,
          week_start: '2026-10-26',
          status: 'declined',
          resolved_at: new Date(NOW.getTime() - 10 * 86_400_000),
        },
        // J'ai refusé l'invitation de B il y a 90 jours : quarantaine levée.
        {
          from_user_id: B,
          to_user_id: ME_Q,
          week_start: '2026-08-10',
          status: 'declined',
          resolved_at: new Date(NOW.getTime() - 90 * 86_400_000),
        },
      ])
      .execute();
    await db
      .updateTable('dating_profiles')
      .set({ questionnaire_v: 1 })
      .where('user_id', '=', ME_Q)
      .execute();
    await consumer.handle(computed(ME_Q, 1, vec(unit(0), unit(1), unit(2))));

    const picks = (await service.currentPicks(ME_Q)).picks.map((pick) => pick.candidate_id);
    expect(picks).not.toContain(A);
    expect(picks).toContain(B);
  });
});
