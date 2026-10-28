import { describe, expect, it } from 'vitest';

import {
  arbitrationPlan,
  correctedElo,
  correctedMatchesPlayed,
  pickMvpWinner,
  resolveKnockoutWinner,
} from './dispute.js';

const HOME = '11111111-1111-4111-8111-111111111111';
const AWAY = '22222222-2222-4222-8222-222222222222';
const P1 = '33333333-3333-4333-8333-333333333333';
const P2 = '44444444-4444-4444-8444-444444444444';

describe('arbitrage d’un litige', () => {
  it('refuse un match qui n’est pas en litige', () => {
    expect(() =>
      arbitrationPlan({
        status: 'validated',
        finalizedAt: new Date(),
        decision: 'validated',
        scoreA: 1,
        scoreB: 0,
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_STATE' }));
    expect(() =>
      arbitrationPlan({
        status: 'disputed',
        finalizedAt: null,
        decision: 'validated',
        scoreA: undefined,
        scoreB: undefined,
      }),
    ).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('valide un litige jamais finalisé sans réversion', () => {
    const plan = arbitrationPlan({
      status: 'disputed',
      finalizedAt: null,
      decision: 'validated',
      scoreA: 2,
      scoreB: 1,
    });
    expect(plan).toEqual({
      nextStatus: 'validated',
      revert: false,
      apply: { scoreA: 2, scoreB: 1 },
      publishValidated: true,
    });
  });

  it('corrige un match déjà validé : réversion puis réapplication', () => {
    const plan = arbitrationPlan({
      status: 'disputed',
      finalizedAt: new Date('2026-11-01T10:00:00Z'),
      decision: 'validated',
      scoreA: 0,
      scoreB: 3,
    });
    expect(plan.revert).toBe(true);
    expect(plan.apply).toEqual({ scoreA: 0, scoreB: 3 });
    expect(plan.publishValidated).toBe(true);
  });

  it('annule sans résultat et sans événement match.validated', () => {
    const plan = arbitrationPlan({
      status: 'disputed',
      finalizedAt: new Date('2026-11-01T10:00:00Z'),
      decision: 'void',
      scoreA: undefined,
      scoreB: undefined,
    });
    expect(plan).toEqual({
      nextStatus: 'cancelled',
      revert: true,
      apply: null,
      publishValidated: false,
    });
  });
});

describe('réversion Elo et statistiques', () => {
  it('retire le delta appliqué sans toucher aux matchs suivants', () => {
    expect(correctedElo({ current: 1050, before: 1000, after: 1024 })).toBe(1026);
  });

  it('ne descend jamais sous le plancher de 100', () => {
    expect(correctedElo({ current: 120, before: 110, after: 200 })).toBe(100);
  });

  it('rend les valeurs inchangées sans historique', () => {
    expect(correctedElo({ current: 1200, before: null, after: null })).toBe(1200);
  });

  it('décrémente le nombre de matchs sans passer sous zéro', () => {
    expect(correctedMatchesPlayed(4)).toBe(3);
    expect(correctedMatchesPlayed(0)).toBe(0);
  });
});

describe('dépouillement du MVP', () => {
  it('départage à égalité par identifiant croissant', () => {
    expect(
      pickMvpWinner([
        { player_id: P2, votes: 2 },
        { player_id: P1, votes: 2 },
      ]),
    ).toBe(P1);
    expect(
      pickMvpWinner([
        { player_id: P1, votes: 1 },
        { player_id: P2, votes: 3 },
      ]),
    ).toBe(P2);
    expect(pickMvpWinner([])).toBeNull();
  });
});

describe('vainqueur d’un match de phase finale', () => {
  it('désigne le meilleur score et ne devine pas un nul', () => {
    expect(
      resolveKnockoutWinner({ homeTeamId: HOME, awayTeamId: AWAY, scoreA: 2, scoreB: 0 }),
    ).toBe(HOME);
    expect(
      resolveKnockoutWinner({ homeTeamId: HOME, awayTeamId: AWAY, scoreA: 0, scoreB: 1 }),
    ).toBe(AWAY);
    expect(
      resolveKnockoutWinner({ homeTeamId: HOME, awayTeamId: AWAY, scoreA: 1, scoreB: 1 }),
    ).toBe(null);
    expect(
      resolveKnockoutWinner({ homeTeamId: HOME, awayTeamId: AWAY, scoreA: null, scoreB: null }),
    ).toBeNull();
  });
});
