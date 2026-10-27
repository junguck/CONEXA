import { BaseEnvSchema, parseEnv } from '@conexa/service-kit';
import { z } from 'zod';

export const EnvSchema = BaseEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(32),
  JWT_ISSUER: z.string().default('conexa-identity'),
  /** Dossier du pilote de stockage local (développement). Jamais versionné. */
  UPLOADS_STORAGE_DIR: z.string().min(1).default('.var/uploads'),
  /**
   * Base publique des URL de lecture. Vide en développement : les URL sont
   * relatives et servies par ce service.
   */
  UPLOADS_PUBLIC_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = parseEnv(EnvSchema);
