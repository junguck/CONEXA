import type { PutDatingProfileInput } from '@conexa/contracts';
import { QUESTIONNAIRE_BLOCKS } from '@conexa/contracts';
import { z } from 'zod';

export const DATING_EMBEDDING_REQUESTED = 'dating.embedding_requested';

const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

/** Une réponse de bloc : option stable, note 1–5, ou choix multiple d'options stables. */
const AnswerSchema = z.union([
  SlugSchema,
  z.number().int().min(1).max(5),
  z
    .array(SlugSchema)
    .min(1)
    .refine((values) => new Set(values).size === values.length, {
      message: 'Les options d’un choix multiple ne doivent pas se répéter',
    }),
]);

const BlockSchema = z
  .record(SlugSchema, AnswerSchema)
  .refine((block) => Object.keys(block).length <= 40, {
    message: '40 réponses maximum par bloc',
  });

const AnswersSchema = z.strictObject({
  values: BlockSchema,
  personality: BlockSchema,
  lifestyle: BlockSchema,
});

/**
 * Schéma producteur canonique de `dating.embedding_requested` v1.
 * Miroir exécutable de `packages/events/src/dating/dating.embedding_requested.v1.json`.
 */
export const DatingEmbeddingRequestedSchema = z.strictObject({
  id: z.uuid(),
  type: z.literal(DATING_EMBEDDING_REQUESTED),
  version: z.literal(1),
  occurred_at: z.iso.datetime({ offset: true }),
  producer: z.literal('dating'),
  traceparent: z.string().optional(),
  payload: z.strictObject({
    user_id: z.string().min(1),
    profile_id: z.string().min(1),
    questionnaire_version: z.number().int().min(1),
    answers: AnswersSchema,
  }),
});

export type DatingEmbeddingRequested = z.infer<typeof DatingEmbeddingRequestedSchema>;

export interface EmbeddingRequestInput {
  userId: string;
  profileId: string;
  questionnaireVersion: number;
  answers: Record<string, string | number>;
  occurredAt: Date;
  traceparent?: string;
  eventId?: string;
}

/** Regroupe les réponses plates du profil dans les trois blocs du contrat. */
export function answersByBlock(
  answers: Record<string, string | number>,
): DatingEmbeddingRequested['payload']['answers'] {
  const blocks: DatingEmbeddingRequested['payload']['answers'] = {
    values: {},
    personality: {},
    lifestyle: {},
  };

  for (const block of QUESTIONNAIRE_BLOCKS) {
    for (const question of block.questions) {
      const value = answers[question.key];
      if (value !== undefined) {
        blocks[block.key][question.key] = value;
      }
    }
  }

  return blocks;
}

/** Chaque bloc doit porter au moins une réponse, sinon aucun signal n'est calculable. */
export function hasSignal(answers: DatingEmbeddingRequested['payload']['answers']): boolean {
  return Object.values(answers).every((block) => Object.keys(block).length > 0);
}

/** JSON stable pour comparer deux profils sans dépendre de l'ordre des clés. */
export function canonicalAnswers(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalAnswers(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalAnswers(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

/**
 * N'émet que si les réponses ou la version de questionnaire changent : un rejeu
 * de la même écriture ne crée pas un second événement logique.
 */
export function shouldRequestEmbedding(
  existing: { questionnaire_v: number; answers: unknown } | null | undefined,
  input: Pick<PutDatingProfileInput, 'questionnaire_v' | 'answers'>,
): boolean {
  if (!existing) {
    return true;
  }
  if (existing.questionnaire_v !== input.questionnaire_v) {
    return true;
  }
  return canonicalAnswers(existing.answers) !== canonicalAnswers(input.answers);
}

/** Construit et valide l'événement avant toute écriture en base. */
export function buildEmbeddingRequestedEvent(
  input: EmbeddingRequestInput,
): DatingEmbeddingRequested {
  const answers = answersByBlock(input.answers);
  if (!hasSignal(answers)) {
    throw new Error('Profil incomplet : aucun bloc de réponses à envoyer au worker IA');
  }

  return DatingEmbeddingRequestedSchema.parse({
    id: input.eventId ?? crypto.randomUUID(),
    type: DATING_EMBEDDING_REQUESTED,
    version: 1,
    occurred_at: input.occurredAt.toISOString(),
    producer: 'dating',
    ...(input.traceparent === undefined ? {} : { traceparent: input.traceparent }),
    payload: {
      user_id: input.userId,
      profile_id: input.profileId,
      questionnaire_version: input.questionnaireVersion,
      answers,
    },
  });
}
