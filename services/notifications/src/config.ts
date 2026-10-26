import { BaseEnvSchema, parseEnv } from '@conexa/service-kit';
import { z } from 'zod';

export const EnvSchema = BaseEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(32),
  JWT_ISSUER: z.string().default('conexa-identity'),
  /** Appels service à service : les domaines poussent une notification. */
  SERVICE_TOKEN: z.string().min(16).optional(),
  /**
   * `console` tant que les clés VAPID ne sont pas générées : rien ne sort du
   * processus. `web_push` refuse de démarrer sans clés (jamais de faux succès).
   */
  PUSH_PROVIDER: z.enum(['console', 'web_push']).default('console'),
  VAPID_PUBLIC_KEY: z.string().min(80).optional(),
  VAPID_PRIVATE_KEY: z.string().min(80).optional(),
  VAPID_SUBJECT: z.string().default('mailto:contact@convexa.app'),
  /** Abonnements abandonnés après N échecs consécutifs (410 supprime tout de suite). */
  PUSH_MAX_FAILURES: z.coerce.number().int().min(1).max(50).default(5),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = parseEnv(EnvSchema);
