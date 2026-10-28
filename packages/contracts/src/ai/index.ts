import { z } from 'zod';

/**
 * Service IA (F4.3, F4.4, F5.1). Il ne décide rien : il calcule un vecteur et
 * classe par similarité. Les contraintes métier (âge, ville, quota) restent
 * dans Dating et Talents, qui appellent ce service en interne.
 */

export const EMBEDDING_OWNER_TYPES = ['dating_profile', 'talent_profile'] as const;
export const EmbeddingOwnerTypeSchema = z.enum(EMBEDDING_OWNER_TYPES);
export type EmbeddingOwnerType = z.infer<typeof EmbeddingOwnerTypeSchema>;

/** `pgvector` n'est pas disponible en local : les vecteurs vivent en `jsonb`. */
export const EMBEDDING_DIMENSIONS = 64;

export const UpsertEmbeddingSchema = z.object({
  owner_type: EmbeddingOwnerTypeSchema,
  owner_id: z.uuid(),
  /** Texte source : réponses au questionnaire, compétences, description. */
  text: z.string().min(3).max(4000),
});
export type UpsertEmbeddingInput = z.infer<typeof UpsertEmbeddingSchema>;

export const EmbeddingSchema = z.object({
  owner_type: EmbeddingOwnerTypeSchema,
  owner_id: z.uuid(),
  dimensions: z.number().int().positive(),
  model: z.string(),
  updated_at: z.iso.datetime(),
});
export type Embedding = z.infer<typeof EmbeddingSchema>;

export const SimilarRequestSchema = z
  .object({
    owner_type: EmbeddingOwnerTypeSchema,
    /** Vecteur de référence : un propriétaire existant, ou un texte à encoder. */
    owner_id: z.uuid().optional(),
    text: z.string().min(3).max(4000).optional(),
    limit: z.number().int().min(1).max(100).default(10),
    exclude: z.array(z.uuid()).max(100).default([]),
  })
  .refine((value) => value.owner_id !== undefined || value.text !== undefined, {
    message: 'owner_id ou text est requis',
  });
export type SimilarRequestInput = z.infer<typeof SimilarRequestSchema>;

export const SimilarMatchSchema = z.object({
  owner_id: z.uuid(),
  score: z.number().min(-1).max(1),
});
export type SimilarMatch = z.infer<typeof SimilarMatchSchema>;

export const SimilarResultSchema = z.object({
  results: z.array(SimilarMatchSchema),
  compared: z.number().int().nonnegative(),
});
export type SimilarResult = z.infer<typeof SimilarResultSchema>;
