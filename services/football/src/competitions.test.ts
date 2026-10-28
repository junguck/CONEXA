import { describe, expect, it } from 'vitest';

import { buildBracket, distributeIntoGroups, nextStageSlot, standingsFor } from './competitions.js';

const team = (id: string) => id;

describe('compétitions : poules', () => {
  it('répartit les équipes de façon déterministe et équilibrée', () => {
    const groups = distributeIntoGroups(['d', 'a', 'c', 'b', 'e'], 3);
    expect(groups.map((group) => group.length)).toEqual([2, 2, 1]);
    expect(groups.flat().sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(distributeIntoGroups(['d', 'a', 'c', 'b', 'e'], 3)).toEqual(groups);
  });

  it('refuse plus de poules que d’équipes', () => {
    expect(() => distributeIntoGroups(['a'], 2)).toThrowError(/poule/i);
  });
});

describe('compétitions : phases finales', () => {
  it('construit un tableau complet par puissance de deux', () => {
    expect(buildBracket(4)).toEqual([
      { stage: 'semi_final', position: 1 },
      { stage: 'semi_final', position: 2 },
      { stage: 'final', position: 1 },
    ]);
    expect(buildBracket(8).filter((slot) => slot.stage === 'quarter_final')).toHaveLength(4);
    expect(buildBracket(16)).toHaveLength(15);
  });

  it('fait avancer une place vers le tour suivant', () => {
    expect(nextStageSlot({ stage: 'quarter_final', position: 1 })).toEqual({
      stage: 'semi_final',
      position: 1,
    });
    expect(nextStageSlot({ stage: 'quarter_final', position: 4 })).toEqual({
      stage: 'semi_final',
      position: 2,
    });
    expect(nextStageSlot({ stage: 'final', position: 1 })).toBeNull();
  });
});

describe('compétitions : classement', () => {
  const matches = [
    { home_team_id: 'a', away_team_id: 'b', score_a: 2, score_b: 0, status: 'validated' },
    { home_team_id: 'c', away_team_id: 'a', score_a: 1, score_b: 1, status: 'validated' },
    { home_team_id: 'b', away_team_id: 'c', score_a: 3, score_b: 3, status: 'forfeited' },
    { home_team_id: 'a', away_team_id: 'c', score_a: 5, score_b: 0, status: 'cancelled' },
    { home_team_id: 'a', away_team_id: 'd', score_a: 5, score_b: 0, status: 'scheduled' },
  ] as const;

  it('compte 3/1/0 et ignore les matchs non terminés', () => {
    const rows = standingsFor(['a', 'b', 'c', 'd'].map(team), matches, null);
    const byTeam = new Map(rows.map((row) => [row.team_id, row]));
    expect(byTeam.get('a')).toMatchObject({
      played: 2,
      won: 1,
      drawn: 1,
      lost: 0,
      goals_for: 3,
      goals_against: 1,
      points: 4,
    });
    expect(byTeam.get('d')).toMatchObject({ played: 0, points: 0 });
  });

  it('trie points, différence, buts marqués puis nom', () => {
    const rows = standingsFor(['a', 'b', 'c'].map(team), matches, null);
    expect(rows.map((row) => row.team_id)).toEqual(['a', 'c', 'b']);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it('filtre le classement par poule', () => {
    const rows = standingsFor(['a', 'b', 'c'].map(team), matches, 1, { a: 1, b: 1, c: 2 });
    expect(rows.map((row) => row.team_id)).toEqual(['a', 'b']);
  });
});
