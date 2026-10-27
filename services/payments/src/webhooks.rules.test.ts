import { describe, expect, it } from 'vitest';

import { payloadFingerprint, webhookEventKey } from './webhooks.rules.js';

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

  it('empreinte le corps brut sans le conserver', () => {
    const digest = payloadFingerprint(JSON.stringify(payload));
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain('campay-ref-1');
  });
});
