import { BaseEnvSchema, parseEnv } from '@conexa/service-kit';
import { z } from 'zod';

export const EnvSchema = BaseEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(32),
  JWT_ISSUER: z.string().default('conexa-identity'),
  /** Écriture côté partenaire (lieux, menus, créneaux, offres). */
  SERVICE_TOKEN: z.string().min(16).optional(),
  PARTNERS_PAGE_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  /** Nombre de créneaux renvoyés dans le détail d'un lieu. */
  PARTNERS_NEXT_SLOTS: z.coerce.number().int().min(1).max(50).default(10),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = parseEnv(EnvSchema);
