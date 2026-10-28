import { BaseEnvSchema, parseEnv } from '@conexa/service-kit';
import { z } from 'zod';

export const EnvSchema = BaseEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(32),
  JWT_ISSUER: z.string().default('conexa-identity'),
  /** Passerelle interne vers Identity pour la révélation du numéro (optionnelle en dev). */
  IDENTITY_URL: z.string().url().optional(),
  SERVICE_TOKEN: z.string().min(16).optional(),
  /** Planificateur interne du relais outbox (patron football, T-0035). */
  DATING_CRON_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  DATING_CRON_INTERVAL_MS: z.coerce.number().int().min(1_000).default(300_000),
  DATING_CRON_INITIAL_DELAY_MS: z.coerce.number().int().min(0).default(30_000),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = parseEnv(EnvSchema);
