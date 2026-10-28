import type { ReconciliationStatus } from '@conexa/contracts';

/**
 * Rapprochement quotidien (`agents/money/README.md`, ADR 0008) : le compte
 * `CASH` du grand livre, **par opérateur**, doit égaler le solde lu chez
 * l'agrégateur pour ce même opérateur. Aucune correction automatique.
 */

export interface CashLine {
  operator: string | null;
  direction: 'debit' | 'credit';
  amount_fcfa: number;
}

/** Solde de caisse par opérateur : débits − crédits, en FCFA entiers. */
export function cashBalanceByOperator(lines: CashLine[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const line of lines) {
    // Une ligne de caisse sans opérateur est un défaut de saisie : elle ne doit
    // pas être fondue dans un opérateur au hasard.
    const key = line.operator ?? 'unknown';
    const signed = line.direction === 'debit' ? line.amount_fcfa : -line.amount_fcfa;
    balances.set(key, (balances.get(key) ?? 0) + signed);
  }
  return balances;
}

/** Écart = solde fournisseur − solde comptable ; 0 attendu. */
export function variance(providerBalanceFcfa: number, ledgerCashFcfa: number): number {
  if (!Number.isInteger(providerBalanceFcfa) || !Number.isInteger(ledgerCashFcfa)) {
    throw new RangeError('Le rapprochement compare des montants entiers en FCFA');
  }
  return providerBalanceFcfa - ledgerCashFcfa;
}

export function reconciliationStatus(varianceFcfa: number): ReconciliationStatus {
  return varianceFcfa === 0 ? 'ok' : 'mismatch';
}

/** Un écart alerte toujours : c'est le point de l'ADR 0008. */
export function needsAlert(varianceFcfa: number): boolean {
  return varianceFcfa !== 0;
}
