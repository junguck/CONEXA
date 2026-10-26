import type { DatingProfile, QuestionnaireBlock } from '@conexa/contracts';
import { validationError } from '@conexa/errors';
import type { Selectable } from 'kysely';

import type { DatingProfilesTable } from './db.js';

export const DATING_CLOCK = Symbol('DATING_CLOCK');
export const AGE_LIMITS_MESSAGE = 'age_min doit être inférieur ou égal à age_max';

/**
 * Les réponses doivent porter exactement les clés du questionnaire, avec des
 * valeurs fermées : aucune chaîne libre ne peut donc être injectée.
 */
export function assertKeysMatchQuestionnaire(
  answers: Record<string, string | number>,
  blocks: QuestionnaireBlock[],
): void {
  const questions = blocks.flatMap((block) => block.questions);
  const known = new Map(questions.map((question) => [question.key, question]));

  for (const key of Object.keys(answers)) {
    if (!known.has(key)) {
      throw validationError(`Question inconnue : ${key}`);
    }
  }

  for (const question of questions) {
    const value = answers[question.key];
    if (value === undefined) {
      throw validationError(`Réponse manquante : ${question.key}`);
    }
    if (question.kind === 'scale') {
      if (typeof value !== 'number' || value < 1 || value > 5) {
        throw validationError(`Réponse invalide pour ${question.key} : note de 1 à 5 attendue`);
      }
    } else if (typeof value !== 'string' || !(question.options ?? []).includes(value)) {
      throw validationError(`Réponse invalide pour ${question.key}`);
    }
  }
}

export function toProfile(row: Selectable<DatingProfilesTable>): DatingProfile {
  return {
    questionnaire_v: row.questionnaire_v,
    answers: (row.answers ?? {}) as Record<string, string | number>,
    seeking: row.seeking as DatingProfile['seeking'],
    age_min: row.age_min,
    age_max: row.age_max,
    paused: row.status === 'paused',
  };
}
