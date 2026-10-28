import { describe, expect, it } from 'vitest';

import { normalizeWebhook, payloadFingerprint, webhookEventKey } from './webhooks.rules.js';

const payload = { reference: 'campay-ref-1', status: 'successful' as const };

describe('dédoublonnage des webhooks', () => {
  it('produit la même clé pour un webhook rejoué à l’identique', () => {
    expect(webhookEventKey('mock', payload)).toBe(webhookEventKey('mock', { ...payload }));
  });

  it('distingue deux statuts et deux fournisseurs', () => {
    expect(webhookEventKey('mock', payload)).not.toBe(
      webhookEventKey('mock', { ...payload, status: 'failed' }),
    );
    expect(webhookEventKey('mock', payload)).not.toBe(webhookEventKey('campay', payload));
  });

  it('préfère notre référence externe à celle du fournisseur', () => {
    expect(webhookEventKey('campay', { ...payload, external_reference: 'payment-id' })).toContain(
      'payment-id',
    );
  });

  it('normalise la charge utile Campay : majuscules et montant en chaîne', () => {
    expect(
      normalizeWebhook({
        status: 'SUCCESSFUL',
        reference: 'campay-ref',
        amount: '1500.00',
        external_reference: 'payment-id',
        signature: 'jwt',
      }),
    ).toEqual({
      reference: 'campay-ref',
      status: 'successful',
      amount_fcfa: 1500,
      external_reference: 'payment-id',
    });
  });

  it('tolère un montant absent (0.00 en attente) et refuse un statut inconnu', () => {
    expect(normalizeWebhook({ status: 'PENDING', reference: 'r' })).toEqual({
      reference: 'r',
      status: 'pending',
    });
    expect(normalizeWebhook({ status: 'FAILED', reference: 'r', amount: '0.00' })).toEqual({
      reference: 'r',
      status: 'failed',
    });
    expect(() => normalizeWebhook({ status: 'MAYBE', reference: 'r' })).toThrow(/Statut/);
    expect(() => normalizeWebhook({ status: 'FAILED' })).toThrow(/sans référence/);
  });

  it('empreinte le corps brut sans le conserver', () => {
    const digest = payloadFingerprint(JSON.stringify(payload));
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain('campay-ref-1');
  });
});
