import { BaseEnvSchema, parseEnv } from '@conexa/service-kit';
import { z } from 'zod';

export const EnvSchema = BaseEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(32),
  JWT_ISSUER: z.string().default('conexa-identity'),
  /** Payments, consulté pour vérifier le paiement d'un abonnement. */
  PAYMENTS_URL: z.string().url().optional(),
  SERVICE_TOKEN: z.string().min(16).optional(),
  /** Durée d'une période payée, en jours (mensuel). */
  BILLING_PERIOD_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = parseEnv(EnvSchema);
