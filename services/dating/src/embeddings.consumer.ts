import { Injectable } from '@nestjs/common';
import { EventEnvelopeSchema } from '@conexa/events';
import { z } from 'zod';

import { db } from './db.js';
import { isValidVector } from './matching.js';

const CONSUMER = 'dating.embeddings';

const Vector = z.custom<number[]>(isValidVector, 'vecteur de 64 nombres finis attendu');

/** Contrat `embedding.computed` v1 (packages/events/src/ai/embedding.computed.v1.json). */
const PayloadSchema = z.object({
  user_id: z.uuid(),
  profile_id: z.string().min(1),
  questionnaire_version: z.number().int().min(1),
  model_version: z.string().min(1),
  dimension: z.literal(64),
  vectors: z.object({ values: Vector, personality: Vector, lifestyle: Vector }),
});

export type EmbeddingOutcome = 'stored' | 'duplicate' | 'stale' | 'unknown_profile';

/**
 * Consomme `embedding.computed` : stocke les trois vecteurs d'un profil. Idempotent
 * par identifiant d'événement (inbox) ; un résultat calculé pour un questionnaire
 * plus ancien que celui du profil est ignoré. Les vecteurs ne sont jamais journalisés.
 */
@Injectable()
export class EmbeddingsConsumer {
  async handle(raw: unknown): Promise<{ outcome: EmbeddingOutcome }> {
    const envelope = EventEnvelopeSchema.parse(raw);
    if (envelope.type !== 'embedding.computed' || envelope.producer !== 'ai') {
      throw new Error('événement inattendu : embedding.computed produit par ai attendu');
    }
    if (envelope.version !== 1) {
      throw new Error(`version d'événement non prise en charge : ${envelope.version}`);
    }
    const payload = PayloadSchema.parse(envelope.payload);

    return db.transaction().execute(async (trx) => {
      const profile = await trx
        .selectFrom('dating_profiles')
        .select(['user_id', 'questionnaire_v'])
        .where('user_id', '=', payload.user_id)
        .forUpdate()
        .executeTakeFirst();
      // Profil inconnu : rien n'est enregistré, l'événement pourra être rejoué.
      if (!profile) return { outcome: 'unknown_profile' as const };

      const first = await trx
        .insertInto('dating_inbox')
        .values({ consumer: CONSUMER, message_id: envelope.id })
        .onConflict((oc) => oc.doNothing())
        .returning('message_id')
        .executeTakeFirst();
      if (!first) return { outcome: 'duplicate' as const };

      if (payload.questionnaire_version < profile.questionnaire_v) {
        return { outcome: 'stale' as const };
      }

      const row = {
        user_id: payload.user_id,
        questionnaire_version: payload.questionnaire_version,
        model_version: payload.model_version,
        values_vec: payload.vectors.values,
        personality_vec: payload.vectors.personality,
        lifestyle_vec: payload.vectors.lifestyle,
        computed_at: new Date(envelope.occurred_at),
      };
      await trx
        .insertInto('profile_vectors')
        .values(row)
        .onConflict((oc) =>
          oc
            .column('user_id')
            .doUpdateSet({
              questionnaire_version: row.questionnaire_version,
              model_version: row.model_version,
              values_vec: row.values_vec,
              personality_vec: row.personality_vec,
              lifestyle_vec: row.lifestyle_vec,
              computed_at: row.computed_at,
            })
            .where('profile_vectors.questionnaire_version', '<=', row.questionnaire_version),
        )
        .execute();
      return { outcome: 'stored' as const };
    });
  }
}
