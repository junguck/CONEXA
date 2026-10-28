import { describe, expect, it } from 'vitest';

import { QUESTIONNAIRE_BLOCKS } from '@conexa/contracts';

import {
  answersByBlock,
  buildEmbeddingRequestedEvent,
  canonicalAnswers,
  DatingEmbeddingRequestedSchema,
  hasSignal,
  shouldRequestEmbedding,
} from './embedding-request.js';

const ANSWERS = Object.fromEntries(
  QUESTIONNAIRE_BLOCKS.flatMap((block) =>
    block.questions.map((question) => [
      question.key,
      question.kind === 'scale' ? 3 : (question.options?.[0] as string),
    ]),
  ),
);

const EVENT_INPUT = {
  userId: '3d2b1f44-9c2a-4e8f-5b7a-1d2c3b4e5f60',
  profileId: '3d2b1f44-9c2a-4e8f-5b7a-1d2c3b4e5f60',
  questionnaireVersion: 1,
  answers: ANSWERS,
  occurredAt: new Date('2026-10-26T09:00:00Z'),
  eventId: '6f1c5f2e-3f0e-4a5a-9b4a-2f2f0c1d9a11',
  traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
};

describe('dating.embedding_requested v1', () => {
  it('produit un événement conforme, groupé par bloc et horodaté avec fuseau', () => {
    const event = buildEmbeddingRequestedEvent(EVENT_INPUT);

    expect(DatingEmbeddingRequestedSchema.safeParse(event).success).toBe(true);
    expect(event.type).toBe('dating.embedding_requested');
    expect(event.version).toBe(1);
    expect(event.producer).toBe('dating');
    expect(event.occurred_at).toBe('2026-10-26T09:00:00.000Z');
    expect(event.traceparent).toBe(EVENT_INPUT.traceparent);
    expect(Object.keys(event.payload.answers).sort()).toEqual([
      'lifestyle',
      'personality',
      'values',
    ]);
    expect(event.payload.answers.values.values_priority).toBe('family');
    expect(event.payload.answers.personality.personality_speaking).toBe(3);
    expect(event.payload.answers.lifestyle.lifestyle_rhythm).toBe('early_bird');
  });

  it('refuse un libellé libre, un doublon de choix multiple ou un bloc inconnu', () => {
    expect(
      DatingEmbeddingRequestedSchema.safeParse({
        ...buildEmbeddingRequestedEvent(EVENT_INPUT),
        payload: {
          ...buildEmbeddingRequestedEvent(EVENT_INPUT).payload,
          answers: {
            values: { values_priority: 'La famille' },
            personality: {},
            lifestyle: {},
          },
        },
      }).success,
    ).toBe(false);

    expect(
      DatingEmbeddingRequestedSchema.safeParse({
        ...buildEmbeddingRequestedEvent(EVENT_INPUT),
        payload: {
          ...buildEmbeddingRequestedEvent(EVENT_INPUT).payload,
          answers: {
            values: { values_priority: ['family', 'family'] },
            personality: {},
            lifestyle: {},
          },
        },
      }).success,
    ).toBe(false);

    expect(
      DatingEmbeddingRequestedSchema.safeParse({
        ...buildEmbeddingRequestedEvent(EVENT_INPUT),
        payload: {
          ...buildEmbeddingRequestedEvent(EVENT_INPUT).payload,
          answers: {
            values: {},
            personality: {},
            lifestyle: {},
            secret: { free_text: 'bonjour' },
          },
        },
      }).success,
    ).toBe(false);
  });

  it('refuse les échelles hors 1–5, les booléens et les flottants', () => {
    for (const invalid of [0, 6, true, 3.5, null]) {
      expect(
        DatingEmbeddingRequestedSchema.safeParse({
          ...buildEmbeddingRequestedEvent(EVENT_INPUT),
          payload: {
            ...buildEmbeddingRequestedEvent(EVENT_INPUT).payload,
            answers: {
              values: { values_trust: invalid },
              personality: {},
              lifestyle: {},
            },
          },
        }).success,
      ).toBe(false);
    }
  });

  it('regroupe les réponses plates et détecte un profil sans signal', () => {
    const blocks = answersByBlock(ANSWERS);
    expect(blocks.values.values_trust).toBe(3);
    expect(blocks.personality.personality_humour).toBe('deadpan');
    expect(hasSignal(blocks)).toBe(true);
    expect(hasSignal({ values: {}, personality: {}, lifestyle: {} })).toBe(false);
    expect(() => buildEmbeddingRequestedEvent({ ...EVENT_INPUT, answers: {} })).toThrowError(
      /Profil incomplet/,
    );
  });

  it('n’émet que si les réponses ou la version changent', () => {
    expect(shouldRequestEmbedding(null, { questionnaire_v: 1, answers: ANSWERS })).toBe(true);
    expect(
      shouldRequestEmbedding(
        { questionnaire_v: 1, answers: { ...ANSWERS } },
        { questionnaire_v: 1, answers: ANSWERS },
      ),
    ).toBe(false);
    expect(
      shouldRequestEmbedding(
        { questionnaire_v: 1, answers: ANSWERS },
        { questionnaire_v: 1, answers: { ...ANSWERS, values_trust: 5 } },
      ),
    ).toBe(true);
    expect(
      shouldRequestEmbedding(
        { questionnaire_v: 1, answers: ANSWERS },
        { questionnaire_v: 2, answers: ANSWERS },
      ),
    ).toBe(true);
  });

  it('compare les réponses sans dépendre de l’ordre des clés', () => {
    expect(canonicalAnswers({ b: 2, a: 1 })).toBe(canonicalAnswers({ a: 1, b: 2 }));
    expect(canonicalAnswers({ a: [1, 2] })).toBe('{"a":[1,2]}');
  });
});
