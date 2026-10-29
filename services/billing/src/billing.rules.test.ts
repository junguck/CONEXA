import { describe, expect, it } from 'vitest';
import { AppError } from '@conexa/errors';

import {
  GRACE_DAYS,
  assertCanActivate,
  assertPaymentMatchesPlan,
  canSubscribe,
  dueTransition,
  fallbackAudience,
  graceUntil,
  hasRights,
  invoiceTotals,
  isActive,
  periodEnd,
  promoAcceptable,
  promoDiscount,
} from './billing.rules.js';

const NOW = new Date('2026-10-26T12:00:00Z');

describe('droits d’un abonnement', () => {
  it('donne les droits tant que la période court', () => {
    expect(isActive({ status: 'active', current_period_end: new Date('2026-11-26') }, NOW)).toBe(
      true,
    );
    expect(isActive({ status: 'active', current_period_end: new Date('2026-10-01') }, NOW)).toBe(
      false,
    );
  });

  it('refuse un abonnement en attente, résilié ou absent', () => {
    expect(isActive({ status: 'pending', current_period_end: null }, NOW)).toBe(false);
    expect(isActive({ status: 'cancelled', current_period_end: new Date('2026-12-01') }, NOW)).toBe(
      false,
    );
    expect(isActive(undefined, NOW)).toBe(false);
  });

  it('traite un plan gratuit sans échéance comme actif', () => {
    expect(isActive({ status: 'active', current_period_end: null }, NOW)).toBe(true);
  });

  it('calcule la fin de période en jours', () => {
    expect(periodEnd(NOW, 30).toISOString()).toBe('2026-11-25T12:00:00.000Z');
    expect(periodEnd(NOW, 365).getUTCFullYear()).toBe(2027);
  });
});

describe('activation d’un abonnement', () => {
  it('n’active qu’un abonnement en attente', () => {
    expect(() => assertCanActivate('pending')).not.toThrow();
    expect(() => assertCanActivate('active')).toThrow(/déjà traité/);
    expect(() => assertCanActivate('cancelled')).toThrow(AppError);
  });

  it('exige un paiement pour un plan payant et aucun pour un plan gratuit', () => {
    expect(() => assertPaymentMatchesPlan(2000, true)).not.toThrow();
    expect(() => assertPaymentMatchesPlan(0, false)).not.toThrow();
    expect(() => assertPaymentMatchesPlan(2000, false)).toThrow(/paiement requis/);
    expect(() => assertPaymentMatchesPlan(0, true)).toThrow(/aucun paiement/);
  });
});

describe('facture et code promo (T-0026)', () => {
  it('applique une remise en plancher FCFA entier, jamais négative', () => {
    expect(promoDiscount(2000, 10)).toBe(200);
    expect(promoDiscount(1999, 10)).toBe(199); // plancher au client
    expect(invoiceTotals(2000, 25)).toEqual({
      base_fcfa: 2000,
      discount_fcfa: 500,
      total_fcfa: 1500,
    });
    // Une remise de 100 % ou plus ne descend jamais sous 0.
    expect(invoiceTotals(2000, 100).total_fcfa).toBe(0);
    expect(invoiceTotals(0, 50).total_fcfa).toBe(0);
  });

  it('refuse une base non entière ou négative', () => {
    expect(() => invoiceTotals(199.99, 10)).toThrow(/entier/);
    expect(() => invoiceTotals(-1, 10)).toThrow(/entier/);
  });

  it('refuse un code inconnu, désactivé, expiré, pas encore ouvert ou épuisé', () => {
    const code = 'BIENVENUE';
    const base = {
      active: true,
      starts_at: null,
      ends_at: null,
      max_redemptions: null,
      redeemed_count: 0,
    };
    expect(() => promoAcceptable(undefined, NOW, code, '')).toThrow(/inconnu/);
    expect(() => promoAcceptable(base, NOW, code, 'AUTRE')).toThrow(/incohérent/);
    expect(() =>
      promoAcceptable({ ...base, active: false }, NOW, code, code),
    ).toThrow(/désactivé/);
    expect(() =>
      promoAcceptable({ ...base, ends_at: new Date(NOW.getTime() - 1) }, NOW, code, code),
    ).toThrow(/expiré/);
    expect(() =>
      promoAcceptable({ ...base, starts_at: new Date(NOW.getTime() + 1) }, NOW, code, code),
    ).toThrow(/pas encore ouvert/);
    expect(() =>
      promoAcceptable({ ...base, max_redemptions: 5, redeemed_count: 5 }, NOW, code, code),
    ).toThrow(/épuisé/);
    expect(() =>
      promoAcceptable({ ...base, max_redemptions: 5, redeemed_count: 4 }, NOW, code, code),
    ).not.toThrow();
  });
});

describe('grâce de 3 jours et expiration (T-0026)', () => {
  it('compte exactement 3 jours, au franc près sur les dates', () => {
    expect(GRACE_DAYS).toBe(3);
    expect(graceUntil(NOW).toISOString()).toBe('2026-10-29T12:00:00.000Z');
  });

  it('conserve les droits du plan pendant la grâce, puis plus du tout', () => {
    const due = { status: 'past_due' as const, current_period_end: NOW, grace_until: graceUntil(NOW) };
    expect(hasRights(due, new Date(NOW.getTime() + 3 * 86_400_000 - 1))).toBe(true);
    expect(hasRights(due, new Date(NOW.getTime() + 3 * 86_400_000))).toBe(false);
    expect(hasRights({ status: 'past_due', current_period_end: null, grace_until: null }, NOW)).toBe(
      false,
    );
    expect(hasRights({ status: 'expired', current_period_end: null }, NOW)).toBe(false);
  });

  it('classe les transitions du balayage quotidien', () => {
    const kicked = NOW.getTime() - 1;
    expect(
      dueTransition('active', new Date(kicked), null, false, NOW),
    ).toBe('past_due');
    // Résiliation demandée : la clôture est directe, sans grâce.
    expect(
      dueTransition('active', new Date(kicked), null, true, NOW),
    ).toBe('cancelled');
    expect(
      dueTransition('active', new Date(NOW.getTime() + 86_400_000), null, false, NOW),
    ).toBeNull();
    // Grâce échue : l'abonnement passe à expired ; tant que la grâce court, rien.
    expect(
      dueTransition('past_due', new Date(kicked), new Date(kicked), false, NOW),
    ).toBe('expired');
    expect(
      dueTransition('past_due', new Date(kicked), graceUntil(NOW), false, NOW),
    ).toBeNull();
    expect(dueTransition('expired', null, null, false, NOW)).toBeNull();
  });
});

describe('audiences', () => {
  it('réserve les plans partenaires et restaurant aux bons rôles', () => {
    expect(canSubscribe('student', 'student')).toBe(true);
    expect(canSubscribe('student', 'organizer')).toBe(true);
    expect(canSubscribe('student', 'partner')).toBe(false);
    expect(canSubscribe('partner_staff', 'partner')).toBe(true);
    expect(canSubscribe('restaurant_staff', 'restaurant')).toBe(true);
    expect(canSubscribe('student', 'restaurant')).toBe(false);
  });

  it('choisit le plan gratuit de repli selon le rôle', () => {
    expect(fallbackAudience('student')).toBe('student');
    expect(fallbackAudience('admin')).toBe('student');
    expect(fallbackAudience('partner_staff')).toBe('partner');
    expect(fallbackAudience('restaurant_staff')).toBe('restaurant');
  });
});
