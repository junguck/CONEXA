import { ORDER_STATUSES, type OrderStatus } from '@conexa/contracts';
import { describe, expect, it } from 'vitest';

import { FixedEntitlementsGateway } from './gateways.js';
import {
  assertListingAllowed,
  assertOrderTransition,
  assertRevisionAllowed,
  autoValidateAt,
  AUTO_VALIDATE_HOURS,
  canTransitionOrder,
  commissionFor,
  findProhibitedTerm,
} from './marketplace.rules.js';

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  requested: ['accepted', 'cancelled'],
  accepted: ['funded', 'cancelled'],
  funded: ['in_progress', 'cancelled', 'disputed'],
  in_progress: ['delivered', 'cancelled', 'disputed'],
  delivered: ['completed', 'disputed', 'in_progress'],
  completed: [],
  cancelled: [],
  disputed: ['completed', 'cancelled'],
};

describe('machine à états des commandes', () => {
  it('couvre exhaustivement la table des transitions', () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        expect(canTransitionOrder(from, to), `${from} → ${to}`).toBe(ALLOWED[from].includes(to));
      }
    }
  });

  it('refuse un saut de séquence', () => {
    expect(() => assertOrderTransition('requested', 'completed')).toThrowError(
      expect.objectContaining({ code: 'INVALID_STATE' }),
    );
  });
});

describe('termes interdits', () => {
  it('refuse la fraude académique, accents et casse compris', () => {
    expect(findProhibitedTerm('Je fais ton devoir de maths')).toBe('fais ton devoir');
    expect(() => assertListingAllowed('Aide pendant l’examen', 'Gestion')).toThrowError(
      expect.objectContaining({ code: 'LISTING_PROHIBITED' }),
    );
    expect(() => assertListingAllowed('Cours de maths niveau L1')).not.toThrow();
  });
});

describe('commission figée', () => {
  it('suit le taux des droits et ne dépend plus du plan ensuite', async () => {
    expect(commissionFor(4000, 8).commissionFcfa).toBe(320);
    const entitlements = new FixedEntitlementsGateway(5, 10);
    const pct = await entitlements.commissionPct('provider');
    expect(commissionFor(4000, pct).commissionFcfa).toBe(200);
    expect(await entitlements.maxActiveListings('provider')).toBe(10);
  });
});

describe('révisions', () => {
  it('refuse au-delà du quota et hors livraison', () => {
    expect(() => assertRevisionAllowed({ status: 'delivered', used: 1, limit: 2 })).not.toThrow();
    expect(() => assertRevisionAllowed({ status: 'delivered', used: 2, limit: 2 })).toThrowError(
      expect.objectContaining({ code: 'REVISIONS_EXHAUSTED' }),
    );
    expect(() => assertRevisionAllowed({ status: 'in_progress', used: 0, limit: 2 })).toThrowError(
      /livraison/,
    );
  });

  it('valide automatiquement après 72 h', () => {
    const delivered = new Date('2026-11-04T10:00:00Z');
    expect(AUTO_VALIDATE_HOURS).toBe(72);
    expect(autoValidateAt(delivered).toISOString()).toBe('2026-11-07T10:00:00.000Z');
  });
});
