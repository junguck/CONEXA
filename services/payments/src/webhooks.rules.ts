import { createHash } from 'node:crypto';

import type { PaymentWebhook } from '@conexa/contracts';
import { validationError } from '@conexa/errors';

/**
 * Un webhook ne fait jamais foi seul : il est d'abord dédoublonné, puis le
 * statut est relu par l'API avant toute transition (`docs/STACK.md` §3.3.3).
 */

/** Empreinte du corps brut : identifie un rejeu sans conserver la charge utile. */
export function payloadFingerprint(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

/**
 * Clé d'idempotence d'un webhook. `external_reference` est notre identifiant,
 * `reference` celle du fournisseur ; on préfère la nôtre quand elle est fournie.
 */
export function webhookEventKey(provider: string, payload: PaymentWebhook): string {
  const key = payload.external_reference ?? payload.reference;
  if (!key) {
    throw validationError('Webhook sans référence exploitable');
  }
  return `${provider}:${key}:${payload.status}`;
}
