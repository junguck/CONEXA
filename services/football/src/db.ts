import { createDb } from '@conexa/service-kit';
import type { ColumnType, Generated } from 'kysely';

import { env } from './config.js';

export interface FieldsTable {
  id: Generated<string>;
  name: string;
  location: string;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface FieldBookingsTable {
  id: Generated<string>;
  field_id: string;
  starts_at: Date;
  ends_at: Date;
  match_id: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface TeamsTable {
  id: Generated<string>;
  name: string;
  filiere_id: number;
  logo_upload_id: string | null;
  level: Generated<'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum'>;
  elo: Generated<number>;
  recruiting: Generated<boolean>;
  status: Generated<'active' | 'dissolved'>;
  captain_id: string;
  matches_played: Generated<number>;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
  dissolved_at: Date | null;
}

export interface TeamMembersTable {
  team_id: string;
  user_id: string;
  role: Generated<'captain' | 'player'>;
  position: 'goalkeeper' | 'defender' | 'midfielder' | 'forward' | null;
  goals: Generated<number>;
  assists: Generated<number>;
  matches: Generated<number>;
  mvp_count: Generated<number>;
  joined_at: ColumnType<Date, Date | undefined, Date>;
  left_at: Date | null;
  cooldown_until: Date | null;
}

export interface TeamInvitesTable {
  id: Generated<string>;
  team_id: string;
  user_id: string;
  direction: 'invite' | 'request';
  created_by: string;
  status: Generated<'pending' | 'accepted' | 'declined' | 'cancelled'>;
  created_at: ColumnType<Date, Date | undefined, never>;
  expires_at: Generated<Date>;
  resolved_at: Date | null;
}

export interface ChallengesTable {
  id: Generated<string>;
  from_team_id: string;
  to_team_id: string;
  field_id: string;
  proposed_at: Date;
  status: Generated<'pending' | 'accepted' | 'declined' | 'countered' | 'cancelled' | 'expired'>;
  parent_id: string | null;
  created_by: string;
  created_at: ColumnType<Date, Date | undefined, never>;
  resolved_at: Date | null;
}

export interface MatchesTable {
  id: Generated<string>;
  challenge_id: string | null;
  home_team_id: string;
  away_team_id: string;
  field_id: string;
  starts_at: Date;
  status: Generated<
    'scheduled' | 'awaiting_reports' | 'validated' | 'disputed' | 'cancelled' | 'forfeited'
  >;
  score_a: number | null;
  score_b: number | null;
  mvp_user_id: string | null;
  elo_home_before: number | null;
  elo_away_before: number | null;
  elo_home_after: number | null;
  elo_away_after: number | null;
  finalized_at: Date | null;
  cancelled_reason: string | null;
  /** Une seule déclaration acceptée faute de seconde (H+24). */
  provisional: Generated<boolean>;
  contest_closed_at: Date | null;
  mvp_closed_at: Date | null;
  competition_id: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface MatchReportsTable {
  id: Generated<string>;
  match_id: string;
  team_id: string;
  submitted_by: string;
  score_a: number;
  score_b: number;
  events: Generated<unknown>;
  evidence_upload_ids: Generated<string[]>;
  submitted_at: ColumnType<Date, Date | undefined, never>;
}

export interface MatchEventsTable {
  id: Generated<string>;
  match_id: string;
  team_id: string;
  player_id: string;
  type: 'goal' | 'assist' | 'own_goal' | 'yellow_card' | 'red_card';
  minute: number;
  related_player_id: string | null;
}

export interface MatchLineupsTable {
  match_id: string;
  team_id: string;
  player_id: string;
}

export interface MatchContestsTable {
  id: Generated<string>;
  match_id: string;
  team_id: string;
  reason: string;
  evidence_upload_ids: Generated<string[]>;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface MvpVotesTable {
  match_id: string;
  voter_id: string;
  player_id: string;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface EloHistoryTable {
  id: Generated<string>;
  team_id: string;
  match_id: string;
  elo_before: number;
  elo_after: number;
  at: ColumnType<Date, Date | undefined, never>;
}

export interface PlayerBadgesTable {
  user_id: string;
  code: string;
  awarded_at: ColumnType<Date, Date | undefined, never>;
}

export interface MatchAdjudicationsTable {
  id: Generated<string>;
  match_id: string;
  admin_id: string;
  decision: 'validated' | 'void';
  score_a: number | null;
  score_b: number | null;
  reason: string;
  evidence_upload_ids: Generated<string[]>;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface CompetitionsTable {
  id: Generated<string>;
  name: string;
  format: 'league' | 'groups' | 'knockout';
  status: Generated<'draft' | 'active' | 'finished'>;
  starts_at: Date;
  ends_at: Date | null;
  created_by: string;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface CompetitionTeamsTable {
  competition_id: string;
  team_id: string;
  group_no: number | null;
  joined_at: ColumnType<Date, Date | undefined, never>;
}

export interface CompetitionSlotsTable {
  id: Generated<string>;
  competition_id: string;
  stage: 'group' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'final';
  position: number;
  match_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  winner_team_id: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface EventOutboxTable {
  id: Generated<string>;
  type: string;
  version: Generated<number>;
  occurred_at: ColumnType<Date, Date | undefined, never>;
  payload: unknown;
  published_at: Date | null;
  attempts: Generated<number>;
  last_error: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface FootballDb {
  fields: FieldsTable;
  field_bookings: FieldBookingsTable;
  teams: TeamsTable;
  team_members: TeamMembersTable;
  team_invites: TeamInvitesTable;
  challenges: ChallengesTable;
  matches: MatchesTable;
  match_reports: MatchReportsTable;
  match_events: MatchEventsTable;
  match_lineups: MatchLineupsTable;
  match_contests: MatchContestsTable;
  mvp_votes: MvpVotesTable;
  elo_history: EloHistoryTable;
  player_badges: PlayerBadgesTable;
  match_adjudications: MatchAdjudicationsTable;
  competitions: CompetitionsTable;
  competition_teams: CompetitionTeamsTable;
  competition_slots: CompetitionSlotsTable;
  event_outbox: EventOutboxTable;
}

const handle = createDb<FootballDb>({ connectionString: env.DATABASE_URL, schema: 'football' });

export const db = handle.db;
export const pingDatabase = handle.ping;
