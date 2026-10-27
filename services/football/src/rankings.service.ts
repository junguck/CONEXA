import { Injectable } from '@nestjs/common';
import type {
  MatchSearchQuery,
  PlayerRankingQuery,
  PlayerRankingRow,
  PlayerStats,
  TeamRankingQuery,
  TeamRankingRow,
  TeamStats,
} from '@conexa/contracts';
import { notFound } from '@conexa/errors';
import { sql } from 'kysely';

import { db } from './db.js';
import { RANKED_MIN_MATCHES } from './elo.js';
import { decodePageCursor, encodePageCursor, toTeam } from './shared.js';
import { TeamsService } from './teams.service.js';

type Form = Array<'W' | 'D' | 'L'>;

@Injectable()
export class RankingsService {
  constructor(private readonly teams: TeamsService) {}

  async fields() {
    return db.selectFrom('fields').selectAll().orderBy('name', 'asc').execute();
  }

  async eloHistory(teamId: string) {
    await this.teams.findTeam(teamId);
    const rows = await db
      .selectFrom('elo_history')
      .selectAll()
      .where('team_id', '=', teamId)
      .orderBy('at', 'desc')
      .limit(50)
      .execute();
    return rows.map((row) => ({
      match_id: row.match_id,
      elo_before: row.elo_before,
      elo_after: row.elo_after,
      at: row.at.toISOString(),
    }));
  }

  async teamStats(teamId: string): Promise<TeamStats> {
    await this.teams.findTeam(teamId);
    const [matches, scorers] = await Promise.all([
      this.finishedMatchesFor(teamId),
      db
        .selectFrom('team_members')
        .select(['user_id', 'goals'])
        .where('team_id', '=', teamId)
        .where('left_at', 'is', null)
        .orderBy('goals', 'desc')
        .limit(5)
        .execute(),
    ]);

    const record = { played: 0, won: 0, drawn: 0, lost: 0 };
    for (const match of matches) {
      const own = match.home_team_id === teamId ? match.score_a : match.score_b;
      const other = match.home_team_id === teamId ? match.score_b : match.score_a;
      if (own === null || other === null) {
        continue;
      }
      record.played += 1;
      if (own > other) {
        record.won += 1;
      } else if (own === other) {
        record.drawn += 1;
      } else {
        record.lost += 1;
      }
    }

    return {
      record,
      form: this.formOf(teamId, matches),
      top_scorers: scorers
        .filter((row) => row.goals > 0)
        .map((row) => ({ user_id: row.user_id, goals: row.goals })),
    };
  }

  async playerStats(userId: string): Promise<PlayerStats> {
    const rows = await db
      .selectFrom('team_members')
      .select(['team_id', 'goals', 'assists', 'matches', 'mvp_count'])
      .where('user_id', '=', userId)
      .execute();
    if (rows.length === 0) {
      throw notFound('Joueur');
    }

    const teamsWithMatches = rows.filter((row) => row.matches > 0).map((row) => row.team_id);
    const firstTeam = teamsWithMatches[0];
    const matches = firstTeam ? await this.finishedMatchesFor(teamsWithMatches) : [];

    return {
      matches: rows.reduce((total, row) => total + row.matches, 0),
      goals: rows.reduce((total, row) => total + row.goals, 0),
      assists: rows.reduce((total, row) => total + row.assists, 0),
      mvp_votes: rows.reduce((total, row) => total + row.mvp_count, 0),
      rating: null,
      form: firstTeam ? this.formOf(firstTeam, matches) : [],
    };
  }

  async playerBadges(userId: string) {
    const rows = await db
      .selectFrom('player_badges')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('awarded_at', 'desc')
      .execute();
    return rows.map((row) => ({
      code: row.code,
      awarded_at: row.awarded_at.toISOString(),
    }));
  }

  async matchHistory(userId: string, query: MatchSearchQuery) {
    const teamRows = await db
      .selectFrom('team_members')
      .select('team_id')
      .where('user_id', '=', userId)
      .execute();
    const teamIds = [...new Set(teamRows.map((row) => row.team_id))];
    if (teamIds.length === 0) {
      return { data: [], next_cursor: null };
    }

    let select = db
      .selectFrom('matches')
      .selectAll()
      .where('status', 'in', ['validated', 'forfeited'])
      .where((eb) => eb.or([eb('home_team_id', 'in', teamIds), eb('away_team_id', 'in', teamIds)]));
    if (query.cursor) {
      select = select.where('starts_at', '<', new Date(decodePageCursor(query.cursor)));
    }

    const rows = await select
      .orderBy('starts_at', 'desc')
      .limit(query.limit + 1)
      .execute();
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const matchIds = page.map((row) => row.id);

    const contributions =
      matchIds.length === 0
        ? []
        : await db
            .selectFrom('match_events')
            .select(['match_id', 'player_id', 'type'])
            .where('match_id', 'in', matchIds)
            .where('player_id', '=', userId)
            .execute();

    return {
      data: page.map((row) => ({
        match_id: row.id,
        starts_at: row.starts_at.toISOString(),
        status: row.status,
        home_team_id: row.home_team_id,
        away_team_id: row.away_team_id,
        score_a: row.score_a,
        score_b: row.score_b,
        goals: contributions.filter((c) => c.match_id === row.id && c.type === 'goal').length,
        assists: contributions.filter((c) => c.match_id === row.id && c.type === 'assist').length,
      })),
      next_cursor:
        rows.length > query.limit && last ? encodePageCursor(last.starts_at.toISOString()) : null,
    };
  }

  async rankingsTeams(query: TeamRankingQuery): Promise<TeamRankingRow[]> {
    let select = db
      .selectFrom('teams')
      .selectAll()
      .where('status', '=', 'active')
      .where('matches_played', '>=', RANKED_MIN_MATCHES);

    if (query.filiere_id) {
      select = select.where('filiere_id', '=', query.filiere_id);
    }
    if (query.level) {
      select = select.where('level', '=', query.level);
    }

    const rows = await select.orderBy('elo', 'desc').limit(query.limit).execute();
    const ids = rows.map((row) => row.id);
    const [counts, matches] = await Promise.all([
      this.teams.memberCounts(ids),
      ids.length === 0 ? [] : this.finishedMatchesFor(ids),
    ]);

    return rows.map((row, index) => ({
      rank: index + 1,
      team: toTeam(row, counts.get(row.id) ?? 0),
      elo: row.elo,
      level: row.level,
      form: this.formOf(row.id, matches),
    }));
  }

  async rankingsPlayers(query: PlayerRankingQuery): Promise<PlayerRankingRow[]> {
    const metric = query.metric;
    const order =
      metric === 'assists'
        ? sql`sum(assists) desc`
        : metric === 'mvp'
          ? sql`sum(mvp_count) desc`
          : metric === 'goals'
            ? sql`sum(goals) desc`
            : sql`sum(goals) desc`;

    const rows = await db
      .selectFrom('team_members')
      .select([
        'user_id',
        sql<number>`sum(goals)::int`.as('goals'),
        sql<number>`sum(assists)::int`.as('assists'),
        sql<number>`sum(mvp_count)::int`.as('mvp'),
        sql<number>`sum(matches)::int`.as('matches'),
      ])
      .where('left_at', 'is', null)
      .groupBy('user_id')
      .orderBy(order)
      .limit(query.limit)
      .execute();

    return rows.map((row, index) => ({
      rank: index + 1,
      user_id: row.user_id,
      value:
        metric === 'assists'
          ? row.assists
          : metric === 'mvp'
            ? row.mvp
            : metric === 'goals'
              ? row.goals
              : 0,
      matches: row.matches,
    }));
  }

  // --- internes ---------------------------------------------------------

  private async finishedMatchesFor(teamIds: string | string[]) {
    const ids = typeof teamIds === 'string' ? [teamIds] : teamIds;
    return db
      .selectFrom('matches')
      .selectAll()
      .where('status', 'in', ['validated', 'forfeited'])
      .where((eb) => eb.or([eb('home_team_id', 'in', ids), eb('away_team_id', 'in', ids)]))
      .orderBy('starts_at', 'desc')
      .execute();
  }

  private formOf(
    teamId: string,
    matches: Awaited<ReturnType<RankingsService['finishedMatchesFor']>>,
  ): Form {
    const form: Form = [];
    for (const match of matches) {
      if (form.length === 5) {
        break;
      }
      const own = match.home_team_id === teamId ? match.score_a : match.score_b;
      const other = match.home_team_id === teamId ? match.score_b : match.score_a;
      if (own === null || other === null) {
        continue;
      }
      form.push(own > other ? 'W' : own === other ? 'D' : 'L');
    }
    return form;
  }
}
