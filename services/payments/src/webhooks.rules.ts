import { createHash } from 'node:crypto';

import { validationError } from '@conexa/errors';

/**
 * Un webhook ne fait jamais foi seul : il est d'abord dédoublonné, puis le
 * statut est relu par l'API avant toute transition (`docs/vendor/campay.md`).
 */

export type WebhookOutcome = 'successful' | 'failed' | 'pending';

export interface NormalizedWebhook {
  reference: string;
  status: WebhookOutcome;
  amount_fcfa?: number;
  external_reference?: string;
}

/** Empreinte du corps brut : identifie un rejeu sans conserver la charge utile. */
export function payloadFingerprint(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

/**
 * Clé d'idempotence d'un webhook. `external_reference` est notre identifiant,
 * `reference` celle du fournisseur ; on préfère la nôtre quand elle est fournie.
 */
export function webhookEventKey(provider: string, payload: NormalizedWebhook): string {
  const key = payload.external_reference ?? payload.reference;
  if (!key) {
    throw validationError('Webhook sans référence exploitable');
  }
  return `${provider}:${key}:${payload.status}`;
}

/**
 * Ramène une notification fournisseur à la forme interne. Campay envoie
 * `SUCCESSFUL`/`FAILED` en majuscules et un montant en chaîne (`"100.00"`),
 * éventuellement décimal : on ne garde que des FCFA entiers.
 */
export function normalizeWebhook(body: unknown): NormalizedWebhook {
  if (typeof body !== 'object' || body === null) {
    throw validationError('Corps de webhook illisible');
  }
  const raw = body as Record<string, unknown>;
  const reference = typeof raw['reference'] === 'string' ? raw['reference'] : undefined;
  if (!reference) {
    throw validationError('Webhook sans référence');
  }

  const status = String(raw['status'] ?? '').toUpperCase();
  if (status !== 'SUCCESSFUL' && status !== 'FAILED' && status !== 'PENDING') {
    throw validationError('Statut de webhook inconnu', { status });
  }

  const amount = raw['amount_fcfa'] ?? raw['amount'];
  const parsedAmount =
    typeof amount === 'number' || typeof amount === 'string' ? Number(amount) : undefined;
  const amountFcfa =
    parsedAmount !== undefined && Number.isFinite(parsedAmount) && parsedAmount > 0
      ? Math.round(parsedAmount)
      : undefined;

  const externalReference =
    typeof raw['external_reference'] === 'string' && raw['external_reference'].length > 0
      ? raw['external_reference']
      : undefined;

  return {
    reference,
    status: status.toLowerCase() as WebhookOutcome,
    ...(amountFcfa === undefined ? {} : { amount_fcfa: amountFcfa }),
    ...(externalReference === undefined ? {} : { external_reference: externalReference }),
  };
}
