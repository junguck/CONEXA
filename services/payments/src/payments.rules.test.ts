import { describe, expect, it } from 'vitest';
import { LEDGER_ACCOUNTS, PAYMENT_STATUSES, type PaymentStatus } from '@conexa/contracts';
import { AppError } from '@conexa/errors';

import {
  assertBalanced,
  assertSplit,
  escrowPosting,
  imbalance,
  refundPosting,
  releasePosting,
} from './ledger.js';
import { PAYMENT_TRANSITIONS, canTransition, isHeldInEscrow } from './payments.rules.js';

describe('grand livre à double écriture', () => {
  it('équilibre chaque type de mouvement', () => {
    const postings = [escrowPosting(8000), releasePosting(8000, 7360), refundPosting(8000)];
    for (const lines of postings) {
      expect(() => assertBalanced(lines)).not.toThrow();
      expect(imbalance(lines)).toBe(0);
    }
  });

  it('débite la caisse et crédite le séquestre à l’encaissement', () => {
    expect(escrowPosting(8000)).toEqual([
      { account: LEDGER_ACCOUNTS.cash, direction: 'debit', amount_fcfa: 8000 },
      { account: LEDGER_ACCOUNTS.escrow, direction: 'credit', amount_fcfa: 8000 },
    ]);
  });

  it('libère le net au prestataire et la commission en produit', () => {
    const lines = releasePosting(8000, 7360);
    expect(lines).toContainEqual({
      account: LEDGER_ACCOUNTS.payable,
      direction: 'credit',
      amount_fcfa: 7360,
    });
    expect(lines).toContainEqual({
      account: LEDGER_ACCOUNTS.revenue,
      direction: 'credit',
      amount_fcfa: 640,
    });
    expect(lines).toContainEqual({
      account: LEDGER_ACCOUNTS.escrow,
      direction: 'debit',
      amount_fcfa: 8000,
    });
  });

  it('détecte une écriture déséquilibrée avant de l’écrire', () => {
    expect(() =>
      assertBalanced([
        { account: LEDGER_ACCOUNTS.cash, direction: 'debit', amount_fcfa: 8000 },
        { account: LEDGER_ACCOUNTS.escrow, direction: 'credit', amount_fcfa: 7900 },
      ]),
    ).toThrow(/déséquilibrée/);
    expect(imbalance([{ direction: 'debit', amount_fcfa: 10 }])).toBe(10);
  });
});

describe('répartition net / commission', () => {
  it('accepte une répartition exacte', () => {
    expect(() => assertSplit(8000, 640, 7360)).not.toThrow();
    expect(() => assertSplit(8000, 720, 7280)).not.toThrow();
  });

  it('refuse une somme incohérente, un négatif ou une décimale', () => {
    expect(() => assertSplit(8000, 640, 7000)).toThrow(/reconstituent/);
    expect(() => assertSplit(8000, -40, 8040)).toThrow(/négatif/);
    expect(() => assertSplit(8000, 640.5, 7359.5)).toThrow(/entiers/);
  });
});

describe('machine à états des paiements', () => {
  it('n’autorise que les transitions de la table', () => {
    const allowed = new Set([
      'pending>escrow',
      'pending>failed',
      'escrow>released',
      'escrow>refund_pending',
      'refund_pending>refunded',
    ]);

    for (const from of PAYMENT_STATUSES) {
      for (const to of PAYMENT_STATUSES) {
        expect(canTransition(from, to), `${from}→${to}`).toBe(allowed.has(`${from}>${to}`));
      }
    }
  });

  it('fige les états terminaux', () => {
    for (const terminal of ['released', 'refunded', 'failed'] as PaymentStatus[]) {
      expect(PAYMENT_TRANSITIONS[terminal]).toEqual([]);
    }
    expect(isHeldInEscrow('escrow')).toBe(true);
    expect(isHeldInEscrow('pending')).toBe(false);
  });

  it('refuse une libération directe d’un paiement non encaissé', () => {
    expect(() => {
      if (!canTransition('pending', 'released')) {
        throw new AppError('INVALID_STATE', 'Transition refusée');
      }
    }).toThrow(AppError);
  });
});
