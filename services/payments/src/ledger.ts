import { LEDGER_ACCOUNTS, type LedgerLine } from '@conexa/contracts';
import { AppError } from '@conexa/errors';

/**
 * Grand livre à **double écriture** : chaque mouvement produit un débit et un
 * crédit de même montant, et la somme des lignes d'une écriture est nulle.
 * C'est la correction du trou n°1 de la roadmap (schéma d'origine à écriture
 * simple) — ADR à valider par un humain, mais l'invariant est déjà testé.
 */

export function escrowPosting(amountFcfa: number): LedgerLine[] {
  return [
    { account: LEDGER_ACCOUNTS.cash, direction: 'debit', amount_fcfa: amountFcfa },
    { account: LEDGER_ACCOUNTS.escrow, direction: 'credit', amount_fcfa: amountFcfa },
  ];
}

export function releasePosting(amountFcfa: number, netFcfa: number): LedgerLine[] {
  const commissionFcfa = amountFcfa - netFcfa;
  assertSplit(amountFcfa, commissionFcfa, netFcfa);
  return [
    { account: LEDGER_ACCOUNTS.escrow, direction: 'debit', amount_fcfa: amountFcfa },
    { account: LEDGER_ACCOUNTS.payable, direction: 'credit', amount_fcfa: netFcfa },
    { account: LEDGER_ACCOUNTS.revenue, direction: 'credit', amount_fcfa: commissionFcfa },
  ];
}

export function refundPosting(amountFcfa: number): LedgerLine[] {
  return [
    { account: LEDGER_ACCOUNTS.escrow, direction: 'debit', amount_fcfa: amountFcfa },
    { account: LEDGER_ACCOUNTS.cash, direction: 'credit', amount_fcfa: amountFcfa },
  ];
}

/** Net + commission doivent reconstituer le montant encaissé, au franc près. */
export function assertSplit(amountFcfa: number, commissionFcfa: number, netFcfa: number): void {
  if (
    !Number.isInteger(amountFcfa) ||
    !Number.isInteger(commissionFcfa) ||
    !Number.isInteger(netFcfa)
  ) {
    throw new AppError('VALIDATION_ERROR', 'Les montants doivent être entiers (FCFA)');
  }
  if (amountFcfa < 0 || commissionFcfa < 0 || netFcfa < 0) {
    throw new AppError('VALIDATION_ERROR', 'Aucun montant ne peut être négatif');
  }
  if (commissionFcfa + netFcfa !== amountFcfa) {
    throw new AppError('VALIDATION_ERROR', 'Net et commission ne reconstituent pas le montant', {
      amount_fcfa: amountFcfa,
      commission_fcfa: commissionFcfa,
      net_fcfa: netFcfa,
    });
  }
}

/** Vérifie l'équilibre d'une écriture avant de l'écrire. */
export function assertBalanced(lines: LedgerLine[]): void {
  const debit = lines
    .filter((line) => line.direction === 'debit')
    .reduce((total, line) => total + line.amount_fcfa, 0);
  const credit = lines
    .filter((line) => line.direction === 'credit')
    .reduce((total, line) => total + line.amount_fcfa, 0);

  if (debit !== credit) {
    throw new AppError('INTERNAL_ERROR', 'Écriture déséquilibrée', {
      debit_fcfa: debit,
      credit_fcfa: credit,
    });
  }
  if (lines.some((line) => line.amount_fcfa < 0)) {
    throw new AppError('INTERNAL_ERROR', 'Montant négatif dans une écriture');
  }
}

/** Rapprochement : l'écart débits/crédits du grand livre doit rester nul. */
export function imbalance(
  lines: Array<{ direction: 'debit' | 'credit'; amount_fcfa: number }>,
): number {
  return lines.reduce(
    (total, line) => total + (line.direction === 'debit' ? line.amount_fcfa : -line.amount_fcfa),
    0,
  );
}
