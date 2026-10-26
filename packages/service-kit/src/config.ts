import { z } from 'zod';

export const BaseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1).optional(),
});

export type BaseEnv = z.infer<typeof BaseEnvSchema>;

/**
 * Lit et valide l'environnement. Échoue au démarrage plutôt qu'à la première
 * requête : un service mal configuré ne doit jamais répondre (STACK.md §5).
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  env: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(env)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuration invalide : ${details}`);
  }
  return parsed.data;
}
