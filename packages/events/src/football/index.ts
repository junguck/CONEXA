import { z } from 'zod';

const IdSchema = z.uuid();

/** Événements publiés par Football (ARCHITECTURE.md §4). */

export const TeamCreatedSchema = z.object({
  team_id: IdSchema,
  captain_id: IdSchema,
  filiere_id: z.number().int().positive(),
});
export type TeamCreated = z.infer<typeof TeamCreatedSchema>;

export const TeamDissolvedSchema = z.object({
  team_id: IdSchema,
  members: z.array(IdSchema),
});

export const MatchScheduledSchema = z.object({
  match_id: IdSchema,
  home_team_id: IdSchema,
  away_team_id: IdSchema,
  starts_at: z.iso.datetime({ offset: true }),
});
export type MatchScheduled = z.infer<typeof MatchScheduledSchema>;

export const MatchValidatedSchema = z.object({
  match_id: IdSchema,
  home_team_id: IdSchema,
  away_team_id: IdSchema,
  score_a: z.number().int().nonnegative(),
  score_b: z.number().int().nonnegative(),
  elo_home_before: z.number().int(),
  elo_home_after: z.number().int(),
  elo_away_before: z.number().int(),
  elo_away_after: z.number().int(),
});
export type MatchValidated = z.infer<typeof MatchValidatedSchema>;

export const MatchDisputedSchema = z.object({
  match_id: IdSchema,
  home_team_id: IdSchema,
  away_team_id: IdSchema,
});

export const FOOTBALL_EVENTS = {
  teamCreated: 'team.created',
  teamDissolved: 'team.dissolved',
  matchScheduled: 'match.scheduled',
  matchValidated: 'match.validated',
  matchDisputed: 'match.disputed',
} as const;
