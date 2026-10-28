import type { DisputeDecision, MatchStatus } from '@conexa/contracts';
import { AppError, validationError } from '@conexa/errors';

import { ELO_FLOOR } from './elo.js';

export interface ArbitrationPlan {
  nextStatus: 'validated' | 'cancelled';
  /** Le résultat précédent doit être retiré avant d'appliquer le nouveau. */
  revert: boolean;
  apply: { scoreA: number; scoreB: number } | null;
  publishValidated: boolean;
}

/**
 * Décide de l'effet d'un arbitrage sans toucher à la base : seul un match en
 * litige est arbitrable, et une validation exige un score complet.
 */
export function arbitrationPlan(input: {
  status: MatchStatus | string;
  finalizedAt: Date | null;
  decision: DisputeDecision;
  scoreA?: number | undefined;
  scoreB?: number | undefined;
}): ArbitrationPlan {
  if (input.status !== 'disputed') {
    throw new AppError('INVALID_STATE', 'Seul un match en litige peut être arbitré');
  }
  const revert = input.finalizedAt !== null;

  if (input.decision === 'void') {
    return { nextStatus: 'cancelled', revert, apply: null, publishValidated: false };
  }

  if (input.scoreA === undefined || input.scoreB === undefined) {
    throw validationError('Un résultat validé exige score_a et score_b');
  }

  return {
    nextStatus: 'validated',
    revert,
    apply: { scoreA: input.scoreA, scoreB: input.scoreB },
    publishValidated: true,
  };
}

/**
 * Retire le delta Elo du match arbitré au classement courant, sans écraser les
 * matchs validés depuis. Une correction ultérieure reste donc additive.
 */
export function correctedElo(input: {
  current: number;
  before: number | null;
  after: number | null;
}): number {
  if (input.before === null || input.after === null) {
    return input.current;
  }
  return Math.max(ELO_FLOOR, input.current - (input.after - input.before));
}

export function correctedMatchesPlayed(current: number): number {
  return Math.max(0, current - 1);
}

/** Dépouillement déterministe : plus de votes, puis plus petit identifiant. */
export function pickMvpWinner(votes: Array<{ player_id: string; votes: number }>): string | null {
  if (votes.length === 0) {
    return null;
  }
  const [winner] = [...votes].sort(
    (left, right) =>
      right.votes - left.votes || left.player_id.localeCompare(right.player_id, 'en'),
  );
  return winner ? winner.player_id : null;
}

/** Vainqueur d'une place de phase finale ; un nul ne désigne personne. */
export function resolveKnockoutWinner(input: {
  homeTeamId: string;
  awayTeamId: string;
  scoreA: number | null;
  scoreB: number | null;
}): string | null {
  if (input.scoreA === null || input.scoreB === null || input.scoreA === input.scoreB) {
    return null;
  }
  return input.scoreA > input.scoreB ? input.homeTeamId : input.awayTeamId;
}

/** Somme les faits d'un match pour pouvoir les retirer lors d'une correction. */
export function negation(aggregate: { goals: Map<string, number>; assists: Map<string, number> }): {
  goals: Map<string, number>;
  assists: Map<string, number>;
} {
  const negate = (source: Map<string, number>) =>
    new Map([...source].map(([playerId, value]) => [playerId, -value]));
  return { goals: negate(aggregate.goals), assists: negate(aggregate.assists) };
}
