import { describe, expect, it } from 'vitest';
import { AppError } from '@conexa/errors';

import {
  assertCanActivate,
  assertPaymentMatchesPlan,
  canSubscribe,
  fallbackAudience,
  isActive,
  periodEnd,
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
