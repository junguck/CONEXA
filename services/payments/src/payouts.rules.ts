import {
  CreatePayoutAccountSchema,
  type CreatePayoutAccountInput,
  type MobileMoneyOperator,
  type PayoutFailureReason,
  type PayoutStatus,
} from '@conexa/contracts';
import { validationError } from '@conexa/errors';

/** Un reversement se retente un nombre borné de fois, puis attend un humain. */
export const MAX_PAYOUT_ATTEMPTS = 5;

/**
 * Un compte de reversement est validé **avant** tout appel : numéro
 * `2376XXXXXXXX` (ER101 éviter) et opérateur MTN ou Orange déclaré (ER102
 * éviter). Le numéro n'est jamais deviné depuis un préfixe.
 */
export function parsePayoutAccount(input: unknown): CreatePayoutAccountInput {
  const parsed = CreatePayoutAccountSchema.safeParse(input);
  if (!parsed.success) {
    throw validationError(
      'Compte de reversement invalide : numéro 2376XXXXXXXX et opérateur MTN ou Orange attendus',
      { issues: parsed.error.issues.map((issue) => issue.path.join('.')) },
    );
  }
  return parsed.data;
}

export type PayoutDecision =
  { action: 'disburse' } | { action: 'queue'; reason: PayoutFailureReason };

/**
 * Décide d'un décaissement. Le solde est celui de **l'opérateur du
 * bénéficiaire** (ER301), jamais un solde global.
 */
export function decidePayout(input: {
  account: { operator: MobileMoneyOperator } | undefined;
  amountFcfa: number;
  balanceFcfa: number;
}): PayoutDecision {
  if (!input.account) {
    return { action: 'queue', reason: 'beneficiary_account_missing' };
  }
  if (input.amountFcfa <= 0 || !Number.isInteger(input.amountFcfa)) {
    throw validationError('Montant de reversement invalide (FCFA entiers positifs attendus)');
  }
  if (input.balanceFcfa < input.amountFcfa) {
    return { action: 'queue', reason: 'insufficient_provider_balance' };
  }
  return { action: 'disburse' };
}

/** Une file « à traiter » se reprend, mais pas indéfiniment. */
export function canRetryPayout(status: PayoutStatus, attempts: number): boolean {
  if (status !== 'queued') {
    return false;
  }
  return attempts < MAX_PAYOUT_ATTEMPTS;
}

/** Motif lisible pour le back-office : jamais un message du fournisseur brut. */
export function payoutFailureReason(error: unknown): PayoutFailureReason {
  const details =
    typeof error === 'object' && error !== null && 'details' in error
      ? (error as { details?: Record<string, unknown> }).details
      : undefined;
  if (details?.['code'] === 'ER301') {
    return 'insufficient_provider_balance';
  }
  return 'provider_refused';
}
