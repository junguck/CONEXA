import { describe, expect, it } from 'vitest';

import { FixedEntitlementsGateway } from './gateways.js';
import {
  assertCanReview,
  assertDelivered,
  assertFunded,
  assertMissionTransition,
  canTransitionMission,
  commissionFor,
  MIN_MISSION_AMOUNT,
} from './talents.rules.js';

describe('commission', () => {
  it('applique 8 % par défaut et rend le net au prestataire', () => {
    expect(commissionFor(5000, 8)).toEqual({ commissionFcfa: 400, netFcfa: 4600, pct: 8 });
  });

  it('suit le taux des droits au lieu d’un taux en dur', async () => {
    const entitlements = new FixedEntitlementsGateway(5);
    const pct = await entitlements.commissionPct('provider');
    expect(pct).toBe(5);
    expect(commissionFor(5000, pct).commissionFcfa).toBe(250);
  });

  it('arrondit au franc et refuse un taux incohérent', () => {
    expect(commissionFor(333, 8).commissionFcfa).toBe(27);
    expect(() => commissionFor(1000, 80)).toThrowError(/Taux de commission invalide/);
  });

  it('pose un plancher de 500 FCFA', () => {
    expect(MIN_MISSION_AMOUNT).toBe(500);
  });
});

describe('machine à états des missions', () => {
  it('autorise uniquement le parcours nominal', () => {
    expect(canTransitionMission('proposed', 'accepted')).toBe(true);
    expect(canTransitionMission('accepted', 'funded')).toBe(true);
    expect(canTransitionMission('funded', 'delivered')).toBe(true);
    expect(canTransitionMission('delivered', 'approved')).toBe(true);
    expect(canTransitionMission('proposed', 'delivered')).toBe(false);
    expect(canTransitionMission('approved', 'disputed')).toBe(false);
  });

  it('refuse la livraison et l’approbation hors séquence', () => {
    expect(() => assertFunded('accepted')).toThrowError(
      expect.objectContaining({ code: 'INVALID_STATE' }),
    );
    expect(() => assertDelivered('funded')).toThrowError(/d’abord livrer/);
    expect(() => assertMissionTransition('proposed', 'funded')).toThrowError(
      /proposed → funded interdite/,
    );
  });
});

describe('avis', () => {
  const mission = {
    status: 'approved' as const,
    clientId: 'client',
    providerId: 'provider',
  };

  it('désigne l’autre participant comme cible', () => {
    expect(assertCanReview({ ...mission, authorId: 'client' })).toBe('provider');
    expect(assertCanReview({ ...mission, authorId: 'provider' })).toBe('client');
  });

  it('refuse un avis avant la fin ou par un tiers', () => {
    expect(() =>
      assertCanReview({ ...mission, status: 'delivered', authorId: 'client' }),
    ).toThrowError(/mission terminée/);
    expect(() => assertCanReview({ ...mission, authorId: 'inconnu' })).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });
});
