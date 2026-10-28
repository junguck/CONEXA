import { z } from 'zod';

import { IdSchema, IsoDateSchema } from '../common/identity.js';
import { PageQuerySchema, pageSchema } from '../common/pagination.js';

export const TEAM_LEVELS = ['unranked', 'bronze', 'silver', 'gold', 'platinum'] as const;
export const TeamLevelSchema = z.enum(TEAM_LEVELS);
export type TeamLevel = z.infer<typeof TeamLevelSchema>;

export const TEAM_ROLES = ['captain', 'player'] as const;
export const TeamRoleSchema = z.enum(TEAM_ROLES);
export type TeamRole = z.infer<typeof TeamRoleSchema>;

export const POSITIONS = ['goalkeeper', 'defender', 'midfielder', 'forward'] as const;
export const PositionSchema = z.enum(POSITIONS);
export type Position = z.infer<typeof PositionSchema>;

export const MATCH_STATUSES = [
  'scheduled',
  'awaiting_reports',
  'validated',
  'disputed',
  'cancelled',
  'forfeited',
] as const;
export const MatchStatusSchema = z.enum(MATCH_STATUSES);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export const CHALLENGE_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'countered',
  'cancelled',
  'expired',
] as const;
export const ChallengeStatusSchema = z.enum(CHALLENGE_STATUSES);
export type ChallengeStatus = z.infer<typeof ChallengeStatusSchema>;

export const MATCH_EVENT_TYPES = ['goal', 'assist', 'own_goal', 'yellow_card', 'red_card'] as const;
export const MatchEventTypeSchema = z.enum(MATCH_EVENT_TYPES);
export type MatchEventType = z.infer<typeof MatchEventTypeSchema>;

export const MatchEventSchema = z.object({
  type: MatchEventTypeSchema,
  minute: z.number().int().min(1).max(130),
  player_id: IdSchema,
  /** Passeur sur un but, fautif sur un carton. */
  related_player_id: IdSchema.optional(),
});
export type MatchEvent = z.infer<typeof MatchEventSchema>;

export const MAX_REPORT_EVENTS = 200;

export const TeamSchema = z.object({
  id: IdSchema,
  name: z.string().min(2).max(48),
  filiere_id: z.number().int().positive(),
  logo_upload_id: IdSchema.nullable(),
  level: TeamLevelSchema,
  elo: z.number().int(),
  recruiting: z.boolean(),
  member_count: z.number().int().nonnegative(),
  created_at: IsoDateSchema,
});
export type Team = z.infer<typeof TeamSchema>;

export const TeamPageSchema = pageSchema(TeamSchema);

export const CreateTeamSchema = z.object({
  name: z.string().trim().min(2).max(48),
  filiere_id: z.number().int().positive(),
  logo_upload_id: IdSchema.optional(),
});
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;

export const UpdateTeamSchema = z
  .object({
    name: z.string().trim().min(2).max(48).optional(),
    logo_upload_id: IdSchema.nullable().optional(),
    recruiting: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ à modifier' });
export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;

export const TeamSearchSchema = PageQuerySchema.extend({
  q: z.string().trim().min(1).max(64).optional(),
  filiere_id: z.coerce.number().int().positive().optional(),
  level: TeamLevelSchema.optional(),
  recruiting: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export type TeamSearchQuery = z.infer<typeof TeamSearchSchema>;

export const TeamMemberSchema = z.object({
  user_id: IdSchema,
  role: TeamRoleSchema,
  position: PositionSchema.nullable(),
  goals: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  matches: z.number().int().nonnegative(),
  joined_at: IsoDateSchema,
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const InviteTeamMemberSchema = z.object({ user_id: IdSchema });

export const SetMemberPositionSchema = z.object({ position: PositionSchema.nullable() });

export const TransferCaptainSchema = z.object({ user_id: IdSchema });

export const INVITE_DIRECTIONS = ['invite', 'request'] as const;
export const InviteDirectionSchema = z.enum(INVITE_DIRECTIONS);
export type InviteDirection = z.infer<typeof InviteDirectionSchema>;

export const CreateChallengeSchema = z.object({
  to_team_id: IdSchema,
  field_id: IdSchema,
  proposed_at: IsoDateSchema,
});
export type CreateChallengeInput = z.infer<typeof CreateChallengeSchema>;

export const CounterChallengeSchema = z.object({
  field_id: IdSchema,
  proposed_at: IsoDateSchema,
});

export const ChallengeSchema = z.object({
  id: IdSchema,
  from_team_id: IdSchema,
  to_team_id: IdSchema,
  field_id: IdSchema,
  proposed_at: IsoDateSchema,
  status: ChallengeStatusSchema,
  created_at: IsoDateSchema,
});
export type Challenge = z.infer<typeof ChallengeSchema>;

export const MatchReportSchema = z.object({
  score_a: z.number().int().min(0).max(99),
  score_b: z.number().int().min(0).max(99),
  events: z.array(MatchEventSchema).max(MAX_REPORT_EVENTS).default([]),
  evidence_upload_ids: z.array(IdSchema).max(10).default([]),
});
export type MatchReportInput = z.infer<typeof MatchReportSchema>;

export const ContestMatchSchema = z.object({
  reason: z.string().trim().min(10).max(500),
  evidence_upload_ids: z.array(IdSchema).min(1).max(10),
});

export const MvpVoteSchema = z.object({ player_id: IdSchema });

export const CancelMatchSchema = z.object({ reason: z.string().trim().min(5).max(300) });

export const SetLineupSchema = z.object({
  player_ids: z.array(IdSchema).min(1).max(16),
});

export const LineupSchema = z.object({
  team_id: IdSchema,
  player_ids: z.array(IdSchema),
});

export const MatchSchema = z.object({
  id: IdSchema,
  home_team_id: IdSchema,
  away_team_id: IdSchema,
  field_id: IdSchema,
  starts_at: IsoDateSchema,
  status: MatchStatusSchema,
  score_a: z.number().int().nonnegative().nullable(),
  score_b: z.number().int().nonnegative().nullable(),
  mvp_user_id: IdSchema.nullable(),
  /** Compétition de rattachement (F2.9), nulle pour un match amical. */
  competition_id: IdSchema.nullable().optional(),
});
export type Match = z.infer<typeof MatchSchema>;

export const MatchDetailSchema = MatchSchema.extend({
  events: z.array(MatchEventSchema),
  lineups: z.array(LineupSchema),
});
export type MatchDetail = z.infer<typeof MatchDetailSchema>;

export const MatchSearchSchema = PageQuerySchema.extend({
  status: MatchStatusSchema.optional(),
  team_id: IdSchema.optional(),
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
});

// --- litiges et arbitrage admin (F2.8) ------------------------------------

export const DISPUTE_DECISIONS = ['validated', 'void'] as const;
export const DisputeDecisionSchema = z.enum(DISPUTE_DECISIONS);
export type DisputeDecision = z.infer<typeof DisputeDecisionSchema>;

export const DISPUTE_SOURCES = ['reports', 'contest'] as const;
export const DisputeSourceSchema = z.enum(DISPUTE_SOURCES);
export type DisputeSource = z.infer<typeof DisputeSourceSchema>;

/** Un litige est arbitrable s'il est `disputed`, qu'il vienne des rapports ou d'une contestation. */
export const DisputeReportSchema = z.object({
  team_id: IdSchema,
  submitted_by: IdSchema,
  score_a: z.number().int().nonnegative(),
  score_b: z.number().int().nonnegative(),
  events: z.array(MatchEventSchema),
  submitted_at: IsoDateSchema,
});
export type DisputeReport = z.infer<typeof DisputeReportSchema>;

export const DisputeContestSchema = z.object({
  team_id: IdSchema,
  reason: z.string(),
  evidence_upload_ids: z.array(IdSchema),
  created_at: IsoDateSchema,
});
export type DisputeContest = z.infer<typeof DisputeContestSchema>;

export const DisputeDetailSchema = MatchSchema.extend({
  finalized_at: IsoDateSchema.nullable(),
  /** Vrai quand une seule déclaration a été acceptée faute de seconde. */
  provisional: z.boolean(),
  source: DisputeSourceSchema,
  reports: z.array(DisputeReportSchema),
  contests: z.array(DisputeContestSchema),
});
export type DisputeDetail = z.infer<typeof DisputeDetailSchema>;

export const DisputedMatchesSchema = z.object({ data: z.array(DisputeDetailSchema) });

export const ResolveDisputeSchema = z
  .object({
    decision: DisputeDecisionSchema,
    /** Obligatoire pour `validated`, ignoré pour `void`. */
    score_a: z.number().int().min(0).max(99).optional(),
    score_b: z.number().int().min(0).max(99).optional(),
    events: z.array(MatchEventSchema).max(MAX_REPORT_EVENTS).default([]),
    reason: z.string().trim().min(10).max(500),
    evidence_upload_ids: z.array(IdSchema).max(10).default([]),
  })
  .refine(
    (value) =>
      value.decision === 'void' || (value.score_a !== undefined && value.score_b !== undefined),
    { message: 'Un résultat validé exige score_a et score_b' },
  );
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>;

export const ArbitrationSchema = z.object({
  id: IdSchema,
  match_id: IdSchema,
  admin_id: IdSchema,
  decision: DisputeDecisionSchema,
  score_a: z.number().int().nonnegative().nullable(),
  score_b: z.number().int().nonnegative().nullable(),
  reason: z.string(),
  created_at: IsoDateSchema,
});
export type Arbitration = z.infer<typeof ArbitrationSchema>;

// --- compétitions (F2.9) ---------------------------------------------------

export const COMPETITION_FORMATS = ['league', 'groups', 'knockout'] as const;
export const CompetitionFormatSchema = z.enum(COMPETITION_FORMATS);
export type CompetitionFormat = z.infer<typeof CompetitionFormatSchema>;

export const COMPETITION_STATUSES = ['draft', 'active', 'finished'] as const;
export const CompetitionStatusSchema = z.enum(COMPETITION_STATUSES);
export type CompetitionStatus = z.infer<typeof CompetitionStatusSchema>;

export const COMPETITION_STAGES = [
  'group',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final',
] as const;
export const CompetitionStageSchema = z.enum(COMPETITION_STAGES);
export type CompetitionStage = z.infer<typeof CompetitionStageSchema>;

export const CompetitionSchema = z.object({
  id: IdSchema,
  name: z.string().min(2).max(64),
  format: CompetitionFormatSchema,
  status: CompetitionStatusSchema,
  starts_at: IsoDateSchema,
  ends_at: IsoDateSchema.nullable(),
  created_at: IsoDateSchema,
});
export type Competition = z.infer<typeof CompetitionSchema>;

export const CreateCompetitionSchema = z.object({
  name: z.string().trim().min(2).max(64),
  format: CompetitionFormatSchema,
  starts_at: IsoDateSchema,
});
export type CreateCompetitionInput = z.infer<typeof CreateCompetitionSchema>;

export const COMPETITION_SEARCH_SCOPES = ['all', 'active', 'draft', 'finished'] as const;
export const CompetitionSearchSchema = z.object({
  status: z.enum(COMPETITION_SEARCH_SCOPES).default('all'),
});
export type CompetitionSearchQuery = z.infer<typeof CompetitionSearchSchema>;

export const RegisterCompetitionTeamSchema = z.object({ team_id: IdSchema });
export const CompetitionTeamSchema = z.object({
  competition_id: IdSchema,
  team_id: IdSchema,
  group_no: z.number().int().positive().nullable(),
  joined_at: IsoDateSchema,
});
export type CompetitionTeam = z.infer<typeof CompetitionTeamSchema>;

export const CompetitionStandingRowSchema = z.object({
  rank: z.number().int().positive(),
  team_id: IdSchema,
  group_no: z.number().int().positive().nullable(),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  drawn: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  goals_for: z.number().int().nonnegative(),
  goals_against: z.number().int().nonnegative(),
  goal_difference: z.number().int(),
  points: z.number().int().nonnegative(),
});
export type CompetitionStandingRow = z.infer<typeof CompetitionStandingRowSchema>;

export const CompetitionStandingsSchema = z.object({
  data: z.array(CompetitionStandingRowSchema),
});

export const GenerateGroupsSchema = z.object({
  groups: z.number().int().min(1).max(8),
});
export type GenerateGroupsInput = z.infer<typeof GenerateGroupsSchema>;

export const GenerateBracketSchema = z.object({
  size: z.union([z.literal(4), z.literal(8), z.literal(16)]),
});
export type GenerateBracketInput = z.infer<typeof GenerateBracketSchema>;

export const BracketSlotSchema = z.object({
  id: IdSchema,
  competition_id: IdSchema,
  stage: CompetitionStageSchema,
  position: z.number().int().positive(),
  match_id: IdSchema.nullable(),
  home_team_id: IdSchema.nullable(),
  away_team_id: IdSchema.nullable(),
  winner_team_id: IdSchema.nullable(),
});
export type BracketSlot = z.infer<typeof BracketSlotSchema>;

export const AttachCompetitionMatchSchema = z.object({ match_id: IdSchema });
export type AttachCompetitionMatchInput = z.infer<typeof AttachCompetitionMatchSchema>;

export const CompetitionBracketSchema = z.object({ data: z.array(BracketSlotSchema) });

export const AdvanceCompetitionSchema = z.object({
  match_id: IdSchema,
});
export type AdvanceCompetitionInput = z.infer<typeof AdvanceCompetitionSchema>;

// --- travaux planifiés (F2.6) ---------------------------------------------

export const FOOTBALL_JOBS = [
  'finalize_stale_reports',
  'close_contest_windows',
  'close_mvp_votes',
  'relay_outbox',
] as const;
export const FootballJobSchema = z.enum(FOOTBALL_JOBS);
export type FootballJob = z.infer<typeof FootballJobSchema>;

export const JobRunResultSchema = z.object({
  job: FootballJobSchema,
  examined: z.number().int().nonnegative(),
  changed: z.number().int().nonnegative(),
  at: IsoDateSchema,
});
export type JobRunResult = z.infer<typeof JobRunResultSchema>;

export const REPORT_STATUSES = ['waiting_other', 'validated', 'disputed'] as const;
export const ReportStatusSchema = z.enum(REPORT_STATUSES);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const RANKING_SCOPES = ['school', 'filiere', 'level'] as const;
export const RankingScopeSchema = z.enum(RANKING_SCOPES);

export const TeamRankingQuerySchema = z.object({
  scope: RankingScopeSchema.default('school'),
  filiere_id: z.coerce.number().int().positive().optional(),
  level: TeamLevelSchema.optional(),
  period: z.enum(['season', 'month']).default('season'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const TeamRankingRowSchema = z.object({
  rank: z.number().int().positive(),
  team: TeamSchema,
  elo: z.number().int(),
  level: TeamLevelSchema,
  form: z.array(z.enum(['W', 'D', 'L'])),
});
export type TeamRankingRow = z.infer<typeof TeamRankingRowSchema>;

export const PLAYER_METRICS = ['goals', 'assists', 'rating', 'mvp', 'clean_sheets'] as const;
export const PlayerMetricSchema = z.enum(PLAYER_METRICS);

export const PlayerRankingQuerySchema = z.object({
  metric: PlayerMetricSchema.default('goals'),
  period: z.enum(['season', 'month']).default('season'),
  filiere_id: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const PlayerRankingRowSchema = z.object({
  rank: z.number().int().positive(),
  user_id: IdSchema,
  value: z.number(),
  matches: z.number().int().nonnegative(),
});
export type PlayerRankingRow = z.infer<typeof PlayerRankingRowSchema>;

export const BADGE_CODES = [
  'first_match',
  'hat_trick',
  'wall',
  'playmaker',
  'mvp_of_the_month',
  'unbeaten_5',
] as const;
export type BadgeCode = (typeof BADGE_CODES)[number];

export const PlayerStatsSchema = z.object({
  matches: z.number().int().nonnegative(),
  goals: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  mvp_votes: z.number().int().nonnegative(),
  rating: z.number().nullable(),
  form: z.array(z.enum(['W', 'D', 'L'])),
});
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;

export const TeamStatsSchema = z.object({
  record: z.object({
    played: z.number().int().nonnegative(),
    won: z.number().int().nonnegative(),
    drawn: z.number().int().nonnegative(),
    lost: z.number().int().nonnegative(),
  }),
  form: z.array(z.enum(['W', 'D', 'L'])),
  top_scorers: z.array(z.object({ user_id: IdSchema, goals: z.number().int().nonnegative() })),
});
export type TeamStats = z.infer<typeof TeamStatsSchema>;

export type MatchSearchQuery = z.infer<typeof MatchSearchSchema>;
export type TeamRankingQuery = z.infer<typeof TeamRankingQuerySchema>;
export type PlayerRankingQuery = z.infer<typeof PlayerRankingQuerySchema>;
