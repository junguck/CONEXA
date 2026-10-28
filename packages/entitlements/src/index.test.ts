import { describe, expect, it } from 'vitest';

import { ENTITLEMENT_KEYS, assertEntitlements, has, limitOf } from './index.js';

const plan = {
  plan_code: 'student_plus',
  commission_pct: 6,
  max_active_listings: 10,
  picks_per_week: 6,
  boost_discount_pct: 20,
  event_commission_pct: 0,
};

describe('droits partagés', () => {
  it('nomme les clés connues et les lit', () => {
    expect(ENTITLEMENT_KEYS).toContain('max_active_listings');
    expect(limitOf(plan, 'max_active_listings')).toBe(10);
  });

  it('refuse un plan incomplet au lieu d’inventer des droits', () => {
    expect(() => assertEntitlements({ plan_code: 'x' })).toThrow(/invalides/);
    expect(assertEntitlements(plan).plan_code).toBe('student_plus');
  });

  it('traite un droit à 0 comme non souscrit', () => {
    expect(has(plan, 'event_commission_pct')).toBe(false);
    expect(has(plan, 'max_active_listings')).toBe(true);
  });
});
