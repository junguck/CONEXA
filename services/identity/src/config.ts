import { BaseEnvSchema, parseEnv } from '@conexa/service-kit';
import { z } from 'zod';

export const EnvSchema = BaseEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  JWT_PRIVATE_KEY: z.string().min(32),
  JWT_PUBLIC_KEY: z.string().min(32),
  JWT_ISSUER: z.string().default('conexa-identity'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OTP_HASH_SECRET: z.string().min(16).default('dev-otp-secret-change-me'),
  /**
   * Jeton partagé attendu sur `/internal/*` (x-service-token). Absent en dev, les
   * routes internes répondent une erreur explicite au lieu d'un faux contact.
   */
  SERVICE_TOKEN: z.string().min(16).optional(),
  /** Fournisseur d'OTP : `console` en développement, `sms` (MBOASMS) en production. */
  OTP_PROVIDER: z.enum(['console', 'sms']).default('console'),
  /** URL d'envoi MBOASMS ; aucune valeur par défaut, elle vient du fournisseur. */
  MBOASMS_URL: z.string().url().optional(),
  MBOASMS_API_KEY: z.string().min(8).optional(),
  /** Émetteur affiché sur le téléphone du destinataire. */
  MBOASMS_SENDER: z.string().min(2).default('CONEXA'),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = parseEnv(EnvSchema);
