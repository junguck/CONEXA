import { BaseEnvSchema, parseEnv } from '@conexa/service-kit';
import { z } from 'zod';

export const EnvSchema = BaseEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(32),
  JWT_ISSUER: z.string().default('conexa-identity'),
  /** Appels service à service : création de fils et notifications par les domaines. */
  SERVICE_TOKEN: z.string().min(16).optional(),
  MESSAGING_PAGE_SIZE: z.coerce.number().int().min(1).max(100).default(30),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = parseEnv(EnvSchema);
