import { describe, expect, it } from 'vitest';

import {
  applyResult,
  expectedScore,
  ELO_FLOOR,
  INITIAL_ELO,
  isRanked,
  kFactor,
  levelFor,
} from './elo.js';

describe('Elo des équipes', () => {
  it('part de 1000 et applique K=48 sur les matchs de mise en place', () => {
    expect(INITIAL_ELO).toBe(1000);
    expect(kFactor(0)).toBe(48);
    expect(kFactor(9)).toBe(48);
    expect(kFactor(10)).toBe(32);
  });

  it('calcule une probabilité symétrique', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 6);
    expect(expectedScore(1200, 1000) + expectedScore(1000, 1200)).toBeCloseTo(1, 6);
    expect(expectedScore(1200, 1000)).toBeCloseTo(0.7597, 3);
  });

  it('donne +24 / -24 à deux nouvelles équipes de même niveau', () => {
    const result = applyResult({
      home: { elo: 1000, matchesPlayed: 0 },
      away: { elo: 1000, matchesPlayed: 0 },
      scoreA: 2,
      scoreB: 1,
    });
    expect(result).toEqual({ home: 1024, away: 976, homeDelta: 24, awayDelta: -24 });
  });

  it('passe à K=32 après dix matchs et ne bouge pas sur un nul équilibré', () => {
    const result = applyResult({
      home: { elo: 1000, matchesPlayed: 10 },
      away: { elo: 1000, matchesPlayed: 12 },
      scoreA: 1,
      scoreB: 1,
    });
    expect(result.home).toBe(1000);
    expect(result.away).toBe(1000);
  });

  it('applique le plancher de 100 sans jamais descendre en dessous', () => {
    const result = applyResult({
      home: { elo: 105, matchesPlayed: 20 },
      away: { elo: 400, matchesPlayed: 20 },
      scoreA: 0,
      scoreB: 3,
    });
    expect(result.home).toBe(ELO_FLOOR);
    expect(result.homeDelta).toBe(-5);
    expect(result.away).toBeGreaterThan(400);
  });

  it('ne classe une équipe qu’à partir de trois matchs validés', () => {
    expect(isRanked(2)).toBe(false);
    expect(isRanked(3)).toBe(true);
    expect(levelFor(1600, 2)).toBe('unranked');
    expect(levelFor(1000, 3)).toBe('bronze');
    expect(levelFor(1150, 5)).toBe('silver');
    expect(levelFor(1350, 5)).toBe('gold');
    expect(levelFor(1600, 5)).toBe('platinum');
  });
});
