import { describe, expect, it } from 'vitest';

import {
  COMPLEMENTARY_MIN_VALUES,
  QUARANTINE_DAYS,
  VECTOR_DIM,
  cosine,
  inQuarantine,
  isValidVector,
  rankPicks,
  similarity,
  type Candidate,
  type ProfileVectors,
} from './matching.js';

/** Vecteur unité sur l'axe `axis`, pour des cosinus exacts (1, 0). */
const unit = (axis: number): number[] =>
  Array.from({ length: VECTOR_DIM }, (_, index) => (index === axis ? 1 : 0));
const mix = (a: number, b: number): number[] =>
  Array.from({ length: VECTOR_DIM }, (_, index) => (index === a || index === b ? 1 : 0));
const profile = (v: number[], p: number[], l: number[]): ProfileVectors => ({
  values: v,
  personality: p,
  lifestyle: l,
});

describe('cosinus et ressemblance', () => {
  it('vaut 1 pour des vecteurs identiques et 0 pour des axes orthogonaux', () => {
    expect(cosine(unit(0), unit(0))).toBeCloseTo(1, 10);
    expect(cosine(unit(0), unit(1))).toBe(0);
  });

  it('un vecteur nul ne donne aucun signal et jamais NaN', () => {
    expect(cosine(new Array(VECTOR_DIM).fill(0), unit(0))).toBe(0);
  });

  it('refuse deux dimensions différentes', () => {
    expect(() => cosine([1], [1, 2])).toThrow();
  });

  it('pondère valeurs 0,5 / personnalité 0,3 / mode de vie 0,2', () => {
    const me = profile(unit(0), unit(1), unit(2));
    const sameValuesOnly = profile(unit(0), unit(5), unit(6));
    expect(similarity(me, sameValuesOnly)).toBeCloseTo(0.5, 10);
    expect(similarity(me, me)).toBeCloseTo(1, 10);
  });
});

describe('quarantaine de 60 jours', () => {
  const now = new Date('2026-11-09T00:00:00Z');
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

  it('jamais refusé : pas de quarantaine', () => {
    expect(inQuarantine(null, now)).toBe(false);
  });

  it('59 jours : encore en quarantaine ; 60 jours exacts : levée', () => {
    expect(QUARANTINE_DAYS).toBe(60);
    expect(inQuarantine(daysAgo(59), now)).toBe(true);
    expect(inQuarantine(daysAgo(60), now)).toBe(false);
    expect(inQuarantine(daysAgo(61), now)).toBe(false);
  });
});

describe('validité des vecteurs', () => {
  it('exige 64 nombres finis', () => {
    expect(isValidVector(unit(0))).toBe(true);
    expect(isValidVector([1, 2])).toBe(false);
    expect(isValidVector(new Array(VECTOR_DIM).fill(Number.NaN))).toBe(false);
    expect(isValidVector('x')).toBe(false);
  });
});

describe('rankPicks (jeu de données connu)', () => {
  const me = profile(unit(0), unit(1), unit(2));
  const candidates: Candidate[] = [
    // identique à moi : meilleur score
    { user_id: 'a', vectors: profile(unit(0), unit(1), unit(2)) },
    // mêmes valeurs et mode de vie, personnalité autre
    { user_id: 'b', vectors: profile(unit(0), unit(7), unit(2)) },
    // valeurs communes, personnalité orthogonale, mode de vie autre : complémentaire
    { user_id: 'c', vectors: profile(mix(0, 3), unit(9), unit(8)) },
    // rien en commun
    { user_id: 'd', vectors: profile(unit(10), unit(11), unit(12)) },
  ];

  it('deux ressemblants puis un complémentaire, scores décroissants', () => {
    const picks = rankPicks(me, candidates);
    expect(picks.map((pick) => [pick.user_id, pick.kind])).toEqual([
      ['a', 'similar'],
      ['b', 'similar'],
      ['c', 'complementary'],
    ]);
    expect(picks[0]!.score).toBeGreaterThan(picks[1]!.score);
  });

  it('est reproductible : même entrée dans un autre ordre, même résultat', () => {
    const first = rankPicks(me, candidates);
    const second = rankPicks(me, [...candidates].reverse());
    expect(second).toEqual(first);
  });

  it('le complémentaire partage assez de valeurs (seuil)', () => {
    expect(COMPLEMENTARY_MIN_VALUES).toBe(0.3);
    const picks = rankPicks(me, [
      { user_id: 'a', vectors: profile(unit(0), unit(1), unit(2)) },
      { user_id: 'b', vectors: profile(unit(0), unit(7), unit(2)) },
      { user_id: 'z', vectors: profile(unit(20), unit(21), unit(22)) },
    ]);
    // z n'a aucune valeur commune : retenu seulement faute de mieux, jamais avant un candidat éligible.
    expect(picks.map((pick) => pick.user_id)).toEqual(['a', 'b', 'z']);
  });

  it('sans vecteur du demandeur : tirage stable par identifiant, score neutre', () => {
    const picks = rankPicks(null, candidates);
    expect(picks.map((pick) => pick.user_id)).toEqual(['a', 'b', 'c']);
    expect(picks.every((pick) => pick.score === 0)).toBe(true);
  });

  it('moins de trois candidats : on propose ce qui existe, sans doublon', () => {
    const picks = rankPicks(me, candidates.slice(0, 2));
    expect(picks.map((pick) => pick.user_id)).toEqual(['a', 'b']);
    expect(rankPicks(me, [])).toEqual([]);
  });

  it('un candidat sans vecteur passe après ceux qui en ont', () => {
    const picks = rankPicks(me, [
      { user_id: 'a', vectors: null },
      { user_id: 'b', vectors: profile(unit(0), unit(1), unit(2)) },
    ]);
    expect(picks[0]!.user_id).toBe('b');
  });
});
