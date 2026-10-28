import type { ProviderStatus } from '@conexa/contracts';

/**
 * Relève de secours (`docs/STACK.md` §3.3.4) : toute la décision est ici, pure
 * et testée ; la tâche ne fait que lire la base et appeler le fournisseur.
 *
 * - toutes les 30 s pendant les 15 premières minutes,
 * - puis toutes les 5 min,
 * - abandon propre quand la fenêtre d'attente est dépassée.
 */
export const POLL_FAST_INTERVAL_MS = 30_000;
export const POLL_FAST_WINDOW_MS = 15 * 60_000;
export const POLL_SLOW_INTERVAL_MS = 5 * 60_000;
/** Attente maximale d'une confirmation avant abandon (surchargeable). */
export const DEFAULT_PENDING_TTL_MS = 30 * 60_000;

export function pollInterval(ageMs: number): number {
  return ageMs < POLL_FAST_WINDOW_MS ? POLL_FAST_INTERVAL_MS : POLL_SLOW_INTERVAL_MS;
}

/** Prochaine relève : l'âge du paiement décide du rythme, pas le nombre d'essais. */
export function nextCheckAt(createdAt: Date, now: Date): Date {
  return new Date(now.getTime() + pollInterval(now.getTime() - createdAt.getTime()));
}

export function expiresAt(createdAt: Date, ttlMs: number = DEFAULT_PENDING_TTL_MS): Date {
  return new Date(createdAt.getTime() + ttlMs);
}

export type PollDecision =
  | { action: 'settle' }
  | { action: 'fail'; reason: 'provider_failure' }
  | { action: 'abandon'; reason: 'expired' }
  | { action: 'reschedule' };

/**
 * Décide à partir du statut **relu par l'API** (jamais d'un webhook seul).
 * Un succès l'emporte sur l'expiration : l'argent est réellement arrivé. Un
 * statut `unknown` (panne, réponse illisible) ne change jamais l'état.
 */
export function decidePoll(input: {
  status: ProviderStatus;
  now: Date;
  expiresAt: Date;
}): PollDecision {
  const expired = input.now.getTime() >= input.expiresAt.getTime();

  if (input.status === 'successful') {
    return { action: 'settle' };
  }
  if (input.status === 'failed') {
    return { action: 'fail', reason: 'provider_failure' };
  }
  return expired ? { action: 'abandon', reason: 'expired' } : { action: 'reschedule' };
}
