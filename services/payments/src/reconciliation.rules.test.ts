import { describe, expect, it } from 'vitest';

import {
  cashBalanceByOperator,
  needsAlert,
  reconciliationStatus,
  variance,
} from './reconciliation.rules.js';

describe('solde de caisse par opérateur', () => {
  it('additionne les débits et retranche les crédits, par opérateur', () => {
    const balances = cashBalanceByOperator([
      { operator: 'mtn_momo', direction: 'debit', amount_fcfa: 8000 },
      { operator: 'orange_money', direction: 'debit', amount_fcfa: 5000 },
      { operator: 'mtn_momo', direction: 'credit', amount_fcfa: 3000 },
      { operator: 'orange_money', direction: 'credit', amount_fcfa: 1000 },
    ]);

    expect(balances.get('mtn_momo')).toBe(5000);
    expect(balances.get('orange_money')).toBe(4000);
  });

  it('isole une ligne de caisse sans opérateur au lieu de la fondre', () => {
    const balances = cashBalanceByOperator([
      { operator: null, direction: 'debit', amount_fcfa: 700 },
      { operator: 'mtn_momo', direction: 'debit', amount_fcfa: 300 },
    ]);
    expect(balances.get('unknown')).toBe(700);
    expect(balances.get('mtn_momo')).toBe(300);
  });
});

describe('écart de rapprochement', () => {
  it('est nul quand le grand livre et le fournisseur sont d’accord', () => {
    expect(variance(12_000, 12_000)).toBe(0);
    expect(reconciliationStatus(0)).toBe('ok');
    expect(needsAlert(0)).toBe(false);
  });

  it('signale tout écart, dans les deux sens', () => {
    expect(variance(12_000, 11_500)).toBe(500);
    expect(reconciliationStatus(500)).toBe('mismatch');
    expect(needsAlert(500)).toBe(true);
    expect(variance(11_500, 12_000)).toBe(-500);
    expect(needsAlert(-500)).toBe(true);
  });

  it('refuse de comparer des montants non entiers', () => {
    expect(() => variance(10.5, 10)).toThrow(/entiers/);
  });
});
