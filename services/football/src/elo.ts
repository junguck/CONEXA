import type { TeamLevel } from '@conexa/contracts';

/**
 * Règles Elo de la v1 (task T-0013) :
 * - départ à 1000, plancher à 100 ;
 * - K = 48 sur les 10 premiers matchs d'une équipe, puis 32 ;
 * - une équipe n'est classée qu'à partir de 3 matchs validés.
 */
export const INITIAL_ELO = 1000;
export const ELO_FLOOR = 100;
export const K_PROVISIONAL = 48;
export const K_STANDARD = 32;
export const PROVISIONAL_MATCHES = 10;
export const RANKED_MIN_MATCHES = 3;

export const PLATINUM_ELO = 1500;
export const GOLD_ELO = 1300;
export const SILVER_ELO = 1100;

export function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + 10 ** ((eloB - eloA) / 400));
}

export function kFactor(matchesPlayed: number): number {
  return matchesPlayed < PROVISIONAL_MATCHES ? K_PROVISIONAL : K_STANDARD;
}

/** 1 = victoire, 0,5 = nul, 0 = défaite. */
export function actualScore(scoreA: number, scoreB: number): number {
  if (scoreA === scoreB) {
    return 0.5;
  }
  return scoreA > scoreB ? 1 : 0;
}

export interface TeamEloState {
  elo: number;
  matchesPlayed: number;
}

export interface EloUpdate {
  home: number;
  away: number;
  homeDelta: number;
  awayDelta: number;
}

/** Calcule les nouveaux Elo d'un match validé ; le plancher s'applique après arrondi. */
export function applyResult(input: {
  home: TeamEloState;
  away: TeamEloState;
  scoreA: number;
  scoreB: number;
}): EloUpdate {
  const expectedHome = expectedScore(input.home.elo, input.away.elo);
  const actualHome = actualScore(input.scoreA, input.scoreB);

  const homeDelta = Math.round(kFactor(input.home.matchesPlayed) * (actualHome - expectedHome));
  const awayDelta = Math.round(
    kFactor(input.away.matchesPlayed) * (1 - actualHome - (1 - expectedHome)),
  );

  const home = Math.max(ELO_FLOOR, input.home.elo + homeDelta);
  const away = Math.max(ELO_FLOOR, input.away.elo + awayDelta);

  return { home, away, homeDelta: home - input.home.elo, awayDelta: away - input.away.elo };
}

export function isRanked(matchesPlayed: number): boolean {
  return matchesPlayed >= RANKED_MIN_MATCHES;
}

export function levelFor(elo: number, matchesPlayed: number): TeamLevel {
  if (!isRanked(matchesPlayed)) {
    return 'unranked';
  }
  if (elo >= PLATINUM_ELO) {
    return 'platinum';
  }
  if (elo >= GOLD_ELO) {
    return 'gold';
  }
  if (elo >= SILVER_ELO) {
    return 'silver';
  }
  return 'bronze';
}
