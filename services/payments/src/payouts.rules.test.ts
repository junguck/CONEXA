import { describe, expect, it } from 'vitest';

import {
  MAX_PAYOUT_ATTEMPTS,
  canRetryPayout,
  decidePayout,
  parsePayoutAccount,
  payoutFailureReason,
} from './payouts.rules.js';

describe('compte de reversement', () => {
  it('accepte un numéro 237 normalisé et un opérateur MTN ou Orange', () => {
    expect(parsePayoutAccount({ operator: 'mtn_momo', msisdn: '237650000001' })).toEqual({
      operator: 'mtn_momo',
      msisdn: '237650000001',
    });
    expect(parsePayoutAccount({ operator: 'orange_money', msisdn: '237690000002' }).operator).toBe(
      'orange_money',
    );
  });

  it('refuse un numéro non mobile money avant tout appel', () => {
    for (const msisdn of ['237250000001', '650000001', '+237650000001', '23765000000']) {
      expect(() => parsePayoutAccount({ operator: 'mtn_momo', msisdn })).toThrow(
        /Compte de reversement invalide/,
      );
    }
  });

  it('refuse un opérateur autre que MTN ou Orange', () => {
    expect(() => parsePayoutAccount({ operator: 'mock', msisdn: '237650000001' })).toThrow(
      /invalide/,
    );
  });
});

describe('décision de décaissement', () => {
  it('décaissement seulement si le solde de l’opérateur suffit', () => {
    expect(
      decidePayout({ account: { operator: 'mtn_momo' }, amountFcfa: 5000, balanceFcfa: 5000 }),
    ).toEqual({ action: 'disburse' });
    expect(
      decidePayout({ account: { operator: 'mtn_momo' }, amountFcfa: 5001, balanceFcfa: 5000 }),
    ).toEqual({ action: 'queue', reason: 'insufficient_provider_balance' });
  });

  it('file « à traiter » si le bénéficiaire n’a pas de compte', () => {
    expect(decidePayout({ account: undefined, amountFcfa: 5000, balanceFcfa: 999_999 })).toEqual({
      action: 'queue',
      reason: 'beneficiary_account_missing',
    });
  });

  it('refuse un montant nul, négatif ou décimal', () => {
    for (const amountFcfa of [0, -100, 99.5]) {
      expect(() =>
        decidePayout({ account: { operator: 'mtn_momo' }, amountFcfa, balanceFcfa: 10_000 }),
      ).toThrow(/Montant de reversement invalide/);
    }
  });

  it('borne les tentatives de la file', () => {
    expect(canRetryPayout('queued', 0)).toBe(true);
    expect(canRetryPayout('queued', MAX_PAYOUT_ATTEMPTS)).toBe(false);
    expect(canRetryPayout('sent', 0)).toBe(false);
  });

  it('traduit ER301 en solde insuffisant, sans message fournisseur brut', () => {
    expect(payoutFailureReason({ details: { code: 'ER301' } })).toBe(
      'insufficient_provider_balance',
    );
    expect(payoutFailureReason(new Error('boom'))).toBe('provider_refused');
  });
});
