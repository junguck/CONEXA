import { EMBEDDING_DIMENSIONS } from '@conexa/contracts';
import { BaseEnvSchema, parseEnv } from '@conexa/service-kit';
import { z } from 'zod';

export const EnvSchema = BaseEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(32),
  JWT_ISSUER: z.string().default('conexa-identity'),
  /** Seuls les services internes encodent et comparent ; pas d'accès utilisateur. */
  SERVICE_TOKEN: z.string().min(16).optional(),
  /** `local` par défaut : aucun fournisseur requis pour développer. */
  AI_PROVIDER: z.enum(['local', 'http']).default('local'),
  EMBEDDINGS_BASE_URL: z.url().optional(),
  EMBEDDINGS_API_KEY: z.string().min(8).optional(),
  EMBEDDINGS_MODEL: z.string().min(2).default('text-embedding-3-small'),
  /** Dimension figée : changer de dimension impose de recalculer les vecteurs. */
  EMBEDDING_DIMENSIONS: z.coerce.number().int().min(16).max(1536).default(EMBEDDING_DIMENSIONS),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = parseEnv(EnvSchema);
