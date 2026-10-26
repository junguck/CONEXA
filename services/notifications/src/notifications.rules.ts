import type { DispatchPushInput, PushMessage } from '@conexa/contracts';

import type { PushOutcome } from './push.provider.js';

/**
 * Règles pures de la poussée : compteur d'échecs, abonnement à supprimer,
 * charge utile reçue par le service worker. Aucune I/O, testées directement.
 */

export function buildPushMessage(input: DispatchPushInput): PushMessage {
  return {
    type: input.type,
    title: input.title,
    body: input.body,
    // Toujours une route interne : un lien externe n'a rien à faire dans une push.
    url: input.url ?? '/notifications',
    tag: input.tag ?? input.type,
  };
}

/** Un succès remet le compteur à zéro : un navigateur qui revient reste abonné. */
export function nextFailureCount(current: number, outcome: PushOutcome): number {
  return outcome.status === 'sent' ? 0 : current + 1;
}

/**
 * Un endpoint mort (404/410) se supprime immédiatement ; sinon on tolère
 * quelques échecs réseau avant d'oublier l'abonnement, pour ne pas déconnecter
 * un téléphone qui a simplement perdu le réseau.
 */
export function shouldPrune(
  outcome: PushOutcome,
  failureCount: number,
  maxFailures: number,
): boolean {
  if (outcome.status === 'sent') return false;
  if (outcome.errorCode === 'SUBSCRIPTION_GONE') return true;
  return failureCount >= maxFailures;
}

/** Un abonnement déjà en échec ne doit pas bloquer l'envoi aux autres. */
export function partitionTargets<T extends { endpoint: string }>(
  targets: T[],
): {
  unique: T[];
  duplicates: number;
} {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const target of targets) {
    if (seen.has(target.endpoint)) continue;
    seen.add(target.endpoint);
    unique.push(target);
  }
  return { unique, duplicates: targets.length - unique.length };
}
