/** Politique de reprise des messages sortants (délai croissant, plafonné, avec jitter). */
export interface RetryPolicy {
  baseDelayMs: number;
  factor: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  baseDelayMs: 1_000,
  factor: 2,
  maxDelayMs: 60_000,
  jitterRatio: 0.2,
};

/**
 * Délai avant la tentative suivante.
 * `random` est injectable : les tests vérifient la progression sans hasard.
 */
export function backoffDelayMs(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  random: () => number = Math.random,
): number {
  const step = Math.max(1, Math.floor(attempt));
  const raw = Math.min(policy.baseDelayMs * policy.factor ** (step - 1), policy.maxDelayMs);
  const jitter = raw * policy.jitterRatio * (random() * 2 - 1);
  return Math.max(0, Math.round(raw + jitter));
}

/** Date de la prochaine tentative à partir de `now`. */
export function nextAttemptAt(
  attempt: number,
  now: Date = new Date(),
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  random: () => number = Math.random,
): Date {
  return new Date(now.getTime() + backoffDelayMs(attempt, policy, random));
}
