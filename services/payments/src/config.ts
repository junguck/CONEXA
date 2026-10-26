import { BaseEnvSchema, parseEnv } from '@conexa/service-kit';
import { z } from 'zod';

export const EnvSchema = BaseEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(32),
  JWT_ISSUER: z.string().default('conexa-identity'),
  /** Agrégateur mobile money : `mock` tant que les clés Campay ne sont pas fournies. */
  PAYMENT_PROVIDER: z.enum(['mock', 'campay']).default('mock'),
  PAYMENTS_WEBHOOK_SECRET: z.string().min(16).default('dev-webhook-secret-change-me'),
  /** Campay : renseigné en production seulement (jamais commité). */
  CAMPAY_BASE_URL: z.string().url().optional(),
  CAMPAY_APP_TOKEN: z.string().min(8).optional(),
  CAMPAY_APP_SECRET: z.string().min(8).optional(),
  /** Jeton des appels service à service (release/refund/entitlements). */
  SERVICE_TOKEN: z.string().min(16).optional(),
  /** Commission par défaut si l'appelant n'en fournit pas (pourcentage). */
  DEFAULT_COMMISSION_PCT: z.coerce.number().int().min(0).max(30).default(8),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = parseEnv(EnvSchema);
