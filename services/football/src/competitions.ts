import type { CompetitionStage, CompetitionStandingRow } from '@conexa/contracts';
import { validationError } from '@conexa/errors';

export interface CompetitionMatchLike {
  home_team_id: string;
  away_team_id: string;
  score_a: number | null;
  score_b: number | null;
  status: string;
}

export interface BracketSlotRef {
  stage: CompetitionStage;
  position: number;
}

const KNOCKOUT_STAGES: CompetitionStage[] = ['round_of_16', 'quarter_final', 'semi_final', 'final'];

const STAGE_SIZE: Record<number, CompetitionStage[]> = {
  4: ['semi_final', 'final'],
  8: ['quarter_final', 'semi_final', 'final'],
  16: ['round_of_16', 'quarter_final', 'semi_final', 'final'],
};

/** Répartition en serpentin : les tailles de poule diffèrent d'au plus un joueur. */
export function distributeIntoGroups(teamIds: string[], groups: number): string[][] {
  if (groups < 1 || groups > teamIds.length) {
    throw validationError('Il faut au moins une équipe par poule', {
      teams: teamIds.length,
      groups,
    });
  }
  const sorted = [...new Set(teamIds)].sort((left, right) => left.localeCompare(right, 'en'));
  if (groups > sorted.length) {
    throw validationError('Il faut au moins une équipe par poule');
  }

  const buckets: string[][] = Array.from({ length: groups }, () => []);
  sorted.forEach((teamId, index) => {
    const bucket = buckets[index % groups];
    if (bucket) {
      bucket.push(teamId);
    }
  });
  return buckets;
}

/** Un tableau à élimination directe de `size` places : `log2(size)` tours. */
export function buildBracket(size: 4 | 8 | 16): BracketSlotRef[] {
  const stages = STAGE_SIZE[size];
  if (!stages) {
    throw validationError('Taille de tableau non supportée', { size });
  }
  const slots: BracketSlotRef[] = [];
  let matchesInStage = size / 2;
  for (const stage of stages) {
    for (let position = 1; position <= matchesInStage; position += 1) {
      slots.push({ stage, position });
    }
    matchesInStage /= 2;
  }
  return slots;
}

export function nextStageSlot(slot: BracketSlotRef): BracketSlotRef | null {
  const index = KNOCKOUT_STAGES.indexOf(slot.stage);
  const next = index === -1 ? undefined : KNOCKOUT_STAGES[index + 1];
  if (!next) {
    return null;
  }
  return { stage: next, position: Math.ceil(slot.position / 2) };
}

export function pointsFor(goalsFor: number, goalsAgainst: number): number {
  if (goalsFor > goalsAgainst) {
    return 3;
  }
  return goalsFor === goalsAgainst ? 1 : 0;
}

export interface StandingAccumulator {
  team_id: string;
  group_no: number | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

/**
 * Classement de compétition : 3 points victoire, 1 nul, 0 défaite, puis
 * différence de buts, buts marqués, identifiant. Les matchs annulés ou en
 * attente ne comptent pas.
 */
export function standingsFor(
  teamIds: string[],
  matches: readonly CompetitionMatchLike[],
  groupNo: number | null,
  groups?: Record<string, number>,
): CompetitionStandingRow[] {
  const selected =
    groupNo === null || groupNo === undefined
      ? [...new Set(teamIds)]
      : [...new Set(teamIds)].filter((teamId) => groups?.[teamId] === groupNo);

  const table = new Map<string, StandingAccumulator>(
    selected.map((teamId) => [
      teamId,
      {
        team_id: teamId,
        group_no: groupNo ?? groups?.[teamId] ?? null,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
      },
    ]),
  );

  for (const match of matches) {
    if (match.status !== 'validated' && match.status !== 'forfeited') {
      continue;
    }
    if (match.score_a === null || match.score_b === null) {
      continue;
    }
    const line = [
      { teamId: match.home_team_id, goalsFor: match.score_a, goalsAgainst: match.score_b },
      { teamId: match.away_team_id, goalsFor: match.score_b, goalsAgainst: match.score_a },
    ];
    for (const side of line) {
      const row = table.get(side.teamId);
      if (!row) {
        continue;
      }
      row.played += 1;
      row.goals_for += side.goalsFor;
      row.goals_against += side.goalsAgainst;
      row.points += pointsFor(side.goalsFor, side.goalsAgainst);
      if (side.goalsFor > side.goalsAgainst) {
        row.won += 1;
      } else if (side.goalsFor === side.goalsAgainst) {
        row.drawn += 1;
      } else {
        row.lost += 1;
      }
    }
  }

  return [...table.values()]
    .map((row) => ({ ...row, goal_difference: row.goals_for - row.goals_against }))
    .sort(
      (left, right) =>
        right.points - left.points ||
        right.goal_difference - left.goal_difference ||
        right.goals_for - left.goals_for ||
        left.team_id.localeCompare(right.team_id, 'en'),
    )
    .map((row, index) => ({ rank: index + 1, ...row }));
}
