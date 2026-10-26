import { describe, expect, it } from 'vitest';

import {
  checkSlotWindow,
  discountFor,
  normalizeCity,
  offerBlockedReason,
  overlaps,
  redemptionCode,
} from './partners.rules.js';

const now = new Date('2026-10-26T10:00:00.000Z');

describe('fenêtre d’un créneau', () => {
  it('accepte un créneau futur de deux heures', () => {
    const verdict = checkSlotWindow(
      new Date('2026-10-27T18:00:00.000Z'),
      new Date('2026-10-27T20:00:00.000Z'),
      now,
    );
    expect(verdict).toEqual({ ok: true, minutes: 120 });
  });

  it('refuse un créneau dans le passé', () => {
    expect(
      checkSlotWindow(
        new Date('2026-10-25T18:00:00.000Z'),
        new Date('2026-10-25T20:00:00.000Z'),
        now,
      ),
    ).toEqual({ ok: false, reason: 'SLOT_IN_PAST' });
  });

  it('refuse moins de 30 minutes', () => {
    expect(
      checkSlotWindow(
        new Date('2026-10-27T18:00:00.000Z'),
        new Date('2026-10-27T18:20:00.000Z'),
        now,
      ),
    ).toEqual({ ok: false, reason: 'SLOT_TOO_SHORT' });
  });

  it('refuse plus de 8 heures', () => {
    expect(
      checkSlotWindow(
        new Date('2026-10-27T08:00:00.000Z'),
        new Date('2026-10-27T20:00:00.000Z'),
        now,
      ),
    ).toEqual({ ok: false, reason: 'SLOT_TOO_LONG' });
  });
});

describe('chevauchement', () => {
  it('détecte un recouvrement partiel', () => {
    expect(
      overlaps(
        {
          startsAt: new Date('2026-10-27T18:00:00.000Z'),
          endsAt: new Date('2026-10-27T20:00:00.000Z'),
        },
        {
          startsAt: new Date('2026-10-27T19:00:00.000Z'),
          endsAt: new Date('2026-10-27T21:00:00.000Z'),
        },
      ),
    ).toBe(true);
  });

  it('laisse deux créneaux bout à bout', () => {
    expect(
      overlaps(
        {
          startsAt: new Date('2026-10-27T18:00:00.000Z'),
          endsAt: new Date('2026-10-27T20:00:00.000Z'),
        },
        {
          startsAt: new Date('2026-10-27T20:00:00.000Z'),
          endsAt: new Date('2026-10-27T22:00:00.000Z'),
        },
      ),
    ).toBe(false);
  });
});

describe('disponibilité d’une offre', () => {
  const base = { quota: 10, redeemed_count: 0, valid_until: null };

  it('est disponible par défaut', () => {
    expect(offerBlockedReason(base, now)).toBeNull();
  });

  it('expire à la date limite', () => {
    expect(
      offerBlockedReason({ ...base, valid_until: '2026-10-26T09:00:00.000Z' }, now),
    ).toBe('expired');
  });

  it('s’épuise au quota', () => {
    expect(offerBlockedReason({ ...base, redeemed_count: 10 }, now)).toBe('exhausted');
  });
});

describe('remise', () => {
  it('applique un pourcentage au franc inférieur', () => {
    expect(discountFor(1500, { kind: 'percent', value: 10 })).toBe(150);
    expect(discountFor(1999, { kind: 'percent', value: 15 })).toBe(299);
  });

  it('plafonne un bon fixe au montant', () => {
    expect(discountFor(800, { kind: 'fixed', value: 2000 })).toBe(800);
  });

  it('ignore un montant nul', () => {
    expect(discountFor(0, { kind: 'percent', value: 20 })).toBe(0);
  });
});

describe('utilitaires', () => {
  it('normalise la ville pour la recherche', () => {
    expect(normalizeCity('  Yaoundé ')).toBe('yaounde');
  });

  it('produit un code lisible sans caractères ambigus', () => {
    const code = redemptionCode(() => 0.999999);
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});
