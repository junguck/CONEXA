import { Inject, Injectable } from '@nestjs/common';
import type { MatchReportInput, ReportStatus } from '@conexa/contracts';
import type { EventPublisher } from '@conexa/events';
import { createEvent } from '@conexa/events';
import { AppError, forbidden, notFound } from '@conexa/errors';
import { sql, type Kysely } from 'kysely';

import { db } from './db.js';
import type { FootballDb } from './db.js';
import { applyResult, levelFor } from './elo.js';
import type { MatchRow } from './matches.service.js';
import { MatchesService } from './matches.service.js';
import { aggregateEvents, badgesForMatch, reconcile } from './report.js';
import { canCancelMatch, contestWindowOpen } from './rules.js';
import { FOOTBALL_CLOCK, FOOTBALL_EVENTS, parseEvents } from './shared.js';

interface Publication {
  type: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class MatchReportService {
  constructor(
    @Inject(FOOTBALL_CLOCK) private readonly now: () => Date,
    @Inject(FOOTBALL_EVENTS) private readonly bus: EventPublisher,
    private readonly matches: MatchesService,
  ) {}

  /** Déclaration d'un capitaine ; la seconde déclaration clôt le match. */
  async report(
    userId: string,
    matchId: string,
    input: MatchReportInput,
  ): Promise<{ status: ReportStatus }> {
    const publications: Publication[] = [];

    const outcome = await db.transaction().execute(async (trx) => {
      const match = await trx
        .selectFrom('matches')
        .selectAll()
        .where('id', '=', matchId)
        .forUpdate()
        .executeTakeFirst();

      if (!match) {
        throw notFound('Match');
      }
      if (match.status !== 'scheduled' && match.status !== 'awaiting_reports') {
        throw new AppError('INVALID_STATE', 'Ce match n’attend plus de déclaration');
      }

      const reportingTeam = await this.teamOfCaptain(trx, match, userId);

      const existing = await trx
        .selectFrom('match_reports')
        .select('id')
        .where('match_id', '=', matchId)
        .where('team_id', '=', reportingTeam)
        .executeTakeFirst();
      if (existing) {
        throw new AppError('REPORT_ALREADY_SUBMITTED', 'Tu as déjà déclaré ce match');
      }

      await trx
        .insertInto('match_reports')
        .values({
          match_id: matchId,
          team_id: reportingTeam,
          submitted_by: userId,
          score_a: input.score_a,
          score_b: input.score_b,
          events: input.events,
          evidence_upload_ids: input.evidence_upload_ids,
        })
        .execute();

      const reports = await trx
        .selectFrom('match_reports')
        .selectAll()
        .where('match_id', '=', matchId)
        .orderBy('submitted_at', 'asc')
        .execute();

      if (reports.length < 2) {
        await trx
          .updateTable('matches')
          .set({ status: 'awaiting_reports' })
          .where('id', '=', matchId)
          .execute();
        return 'waiting_other';
      }

      const [first, second] = reports;
      if (!first || !second) {
        return 'waiting_other';
      }
      const verdict = reconcile(
        { score_a: first.score_a, score_b: first.score_b, events: parseEvents(first.events) },
        { score_a: second.score_a, score_b: second.score_b, events: parseEvents(second.events) },
      );

      if (verdict === 'disputed') {
        await trx
          .updateTable('matches')
          .set({ status: 'disputed' })
          .where('id', '=', matchId)
          .execute();
        publications.push({
          type: 'match.disputed',
          payload: {
            match_id: match.id,
            home_team_id: match.home_team_id,
            away_team_id: match.away_team_id,
          },
        });
        return 'disputed';
      }

      await this.finalize(trx, match, {
        scoreA: first.score_a,
        scoreB: first.score_b,
        events: parseEvents(first.events),
        reportingTeam,
        status: 'validated',
        publications,
      });

      return 'validated';
    });

    // Un seul lot par décision : la sémantique du port (et de l'outbox) est
    // « un lot = une publication, un accusé, une reprise ».
    await this.bus.publish(
      publications.map((item) =>
        createEvent({ type: item.type, producer: 'football', payload: item.payload }),
      ),
    );

    return { status: outcome as ReportStatus };
  }

  async setLineup(userId: string, matchId: string, playerIds: string[]): Promise<void> {
    const match = await this.matches.findMatch(matchId);
    const teamId = await this.teamOfCaptain(db, match, userId);
    const members = await db
      .selectFrom('team_members')
      .select('user_id')
      .where('team_id', '=', teamId)
      .where('left_at', 'is', null)
      .where('user_id', 'in', playerIds)
      .execute();
    if (members.length !== new Set(playerIds).size) {
      throw new AppError('VALIDATION_ERROR', 'Tous les joueurs doivent être dans ton effectif');
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('match_lineups')
        .where('match_id', '=', matchId)
        .where('team_id', '=', teamId)
        .execute();
      await trx
        .insertInto('match_lineups')
        .values(
          [...new Set(playerIds)].map((playerId) => ({
            match_id: matchId,
            team_id: teamId,
            player_id: playerId,
          })),
        )
        .execute();
    });
  }

  async cancel(userId: string, matchId: string, reason: string): Promise<void> {
    const match = await this.matches.findMatch(matchId);
    await this.teamOfCaptain(db, match, userId);
    if (match.status !== 'scheduled' && match.status !== 'awaiting_reports') {
      throw new AppError('INVALID_STATE', 'Ce match ne peut plus être annulé');
    }
    if (!canCancelMatch(match.starts_at, this.now())) {
      throw new AppError(
        'CANCEL_WINDOW_CLOSED',
        'Annulation impossible à moins de 2 h du coup d’envoi',
      );
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('matches')
        .set({ status: 'cancelled', cancelled_reason: reason })
        .where('id', '=', matchId)
        .execute();
      await trx.deleteFrom('field_bookings').where('match_id', '=', matchId).execute();
    });
  }

  /** Applique le résultat une seule fois : Elo, statistiques, badges, journal. */
  private async finalize(
    trx: Kysely<FootballDb>,
    match: MatchRow,
    input: {
      scoreA: number;
      scoreB: number;
      events: MatchReportInput['events'];
      reportingTeam: string;
      status: 'validated' | 'forfeited';
      publications: Publication[];
    },
  ): Promise<void> {
    const [home, away] = await Promise.all([
      trx
        .selectFrom('teams')
        .selectAll()
        .where('id', '=', match.home_team_id)
        .forUpdate()
        .executeTakeFirstOrThrow(),
      trx
        .selectFrom('teams')
        .selectAll()
        .where('id', '=', match.away_team_id)
        .forUpdate()
        .executeTakeFirstOrThrow(),
    ]);
    const now = this.now();
    const elo = applyResult({
      home: { elo: home.elo, matchesPlayed: home.matches_played },
      away: { elo: away.elo, matchesPlayed: away.matches_played },
      scoreA: input.scoreA,
      scoreB: input.scoreB,
    });

    await trx
      .updateTable('teams')
      .set({
        elo: elo.home,
        matches_played: home.matches_played + 1,
        level: levelFor(elo.home, home.matches_played + 1),
        updated_at: now,
      })
      .where('id', '=', home.id)
      .execute();
    await trx
      .updateTable('teams')
      .set({
        elo: elo.away,
        matches_played: away.matches_played + 1,
        level: levelFor(elo.away, away.matches_played + 1),
        updated_at: now,
      })
      .where('id', '=', away.id)
      .execute();

    await trx
      .insertInto('elo_history')
      .values([
        { team_id: home.id, match_id: match.id, elo_before: home.elo, elo_after: elo.home },
        { team_id: away.id, match_id: match.id, elo_before: away.elo, elo_after: elo.away },
      ])
      .onConflict((oc) => oc.doNothing())
      .execute();

    await trx
      .updateTable('matches')
      .set({
        status: input.status,
        score_a: input.scoreA,
        score_b: input.scoreB,
        elo_home_before: home.elo,
        elo_away_before: away.elo,
        elo_home_after: elo.home,
        elo_away_after: elo.away,
        finalized_at: now,
      })
      .where('id', '=', match.id)
      .execute();

    if (input.events.length > 0) {
      await trx
        .insertInto('match_events')
        .values(
          input.events.map((event) => ({
            match_id: match.id,
            team_id: input.reportingTeam,
            player_id: event.player_id,
            type: event.type,
            minute: event.minute,
            related_player_id: event.related_player_id ?? null,
          })),
        )
        .execute();
    }

    const lineups = await trx
      .selectFrom('match_lineups')
      .selectAll()
      .where('match_id', '=', match.id)
      .execute();

    for (const row of lineups) {
      await trx
        .updateTable('team_members')
        .set({ matches: sql`matches + 1` })
        .where('team_id', '=', row.team_id)
        .where('user_id', '=', row.player_id)
        .execute();
    }

    const aggregated = aggregateEvents(input.events);
    for (const [playerId, goals] of aggregated.goals) {
      await trx
        .updateTable('team_members')
        .set({ goals: sql`goals + ${goals}` })
        .where('user_id', '=', playerId)
        .execute();
    }
    for (const [playerId, assists] of aggregated.assists) {
      await trx
        .updateTable('team_members')
        .set({ assists: sql`assists + ${assists}` })
        .where('user_id', '=', playerId)
        .execute();
    }

    const badges = new Map<string, string[]>();
    for (const row of lineups) {
      badges.set(
        row.player_id,
        badgesForMatch({
          goals: aggregated.goals.get(row.player_id) ?? 0,
          assists: aggregated.assists.get(row.player_id) ?? 0,
          firstMatch: true,
        }),
      );
    }
    const badgeRows = [...badges].flatMap(([userId, codes]) =>
      codes.map((code) => ({ user_id: userId, code })),
    );
    if (badgeRows.length > 0) {
      await trx
        .insertInto('player_badges')
        .values(badgeRows)
        .onConflict((oc) => oc.doNothing())
        .execute();
    }

    input.publications.push({
      type: 'match.validated',
      payload: {
        match_id: match.id,
        home_team_id: home.id,
        away_team_id: away.id,
        score_a: input.scoreA,
        score_b: input.scoreB,
        elo_home_before: home.elo,
        elo_home_after: elo.home,
        elo_away_before: away.elo,
        elo_away_after: elo.away,
      },
    });
  }

  async contest(
    userId: string,
    matchId: string,
    input: { reason: string; evidence_upload_ids: string[] },
  ): Promise<void> {
    const match = await this.matches.findMatch(matchId);
    const teamId = await this.teamOfCaptain(db, match, userId);
    if (match.status !== 'validated') {
      throw new AppError('INVALID_STATE', 'Seul un match validé peut être contesté');
    }
    if (!contestWindowOpen(match.finalized_at, this.now())) {
      throw new AppError('INVALID_STATE', 'La fenêtre de contestation de 48 h est fermée');
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('match_contests')
        .values({
          match_id: matchId,
          team_id: teamId,
          reason: input.reason,
          evidence_upload_ids: input.evidence_upload_ids,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
      await trx
        .updateTable('matches')
        .set({ status: 'disputed' })
        .where('id', '=', matchId)
        .execute();
    });
  }

  async voteMvp(userId: string, matchId: string, playerId: string): Promise<void> {
    const match = await this.matches.findMatch(matchId);
    if (match.status !== 'validated' && match.status !== 'forfeited') {
      throw new AppError('INVALID_STATE', 'Le vote MVP ouvre après la validation du match');
    }

    const lineups = await db
      .selectFrom('match_lineups')
      .selectAll()
      .where('match_id', '=', matchId)
      .execute();
    const voter = lineups.find((row) => row.player_id === userId);
    if (!voter) {
      throw forbidden('Seuls les joueurs alignés votent');
    }
    const voted = lineups.find((row) => row.player_id === playerId);
    if (!voted) {
      throw notFound('Joueur aligné');
    }
    if (voted.team_id === voter.team_id) {
      throw forbidden('Le vote est réservé à l’équipe adverse');
    }

    await db
      .insertInto('mvp_votes')
      .values({ match_id: matchId, voter_id: userId, player_id: playerId })
      .onConflict((oc) => oc.columns(['match_id', 'voter_id']).doUpdateSet({ player_id: playerId }))
      .execute();

    const votes = await db
      .selectFrom('mvp_votes')
      .select('player_id')
      .where('match_id', '=', matchId)
      .execute();
    const tally = new Map<string, number>();
    for (const vote of votes) {
      tally.set(vote.player_id, (tally.get(vote.player_id) ?? 0) + 1);
    }
    const [leader] = [...tally].sort((a, b) => b[1] - a[1]);
    if (!leader) {
      return;
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('matches')
        .set({ mvp_user_id: leader[0] })
        .where('id', '=', matchId)
        .execute();
      await trx
        .updateTable('team_members')
        .set({ mvp_count: sql`mvp_count + 1` })
        .where('user_id', '=', leader[0])
        .where('left_at', 'is', null)
        .execute();
    });
  }

  /** Forfait de l’adversaire déclaré par un capitaine : victoire 3-0 sur tapis vert. */
  async forfeit(userId: string, matchId: string): Promise<void> {
    const match = await this.matches.findMatch(matchId);
    const teamId = await this.teamOfCaptain(db, match, userId);
    if (match.status !== 'scheduled' && match.status !== 'awaiting_reports') {
      throw new AppError('INVALID_STATE', 'Ce match ne peut plus être déclaré forfait');
    }

    const publications: Publication[] = [];
    await db.transaction().execute(async (trx) => {
      const isHome = teamId === match.home_team_id;
      await this.finalize(trx, match, {
        scoreA: isHome ? 3 : 0,
        scoreB: isHome ? 0 : 3,
        events: [],
        reportingTeam: teamId,
        status: 'forfeited',
        publications,
      });
    });

    // Un seul lot par décision : la sémantique du port (et de l'outbox) est
    // « un lot = une publication, un accusé, une reprise ».
    await this.bus.publish(
      publications.map((item) =>
        createEvent({ type: item.type, producer: 'football', payload: item.payload }),
      ),
    );
  }

  // --- internes ---------------------------------------------------------

  private async teamOfCaptain(
    executor: Kysely<FootballDb>,
    match: MatchRow,
    userId: string,
  ): Promise<string> {
    const team = await executor
      .selectFrom('teams')
      .select('id')
      .where('id', 'in', [match.home_team_id, match.away_team_id])
      .where('captain_id', '=', userId)
      .executeTakeFirst();
    if (!team) {
      throw new AppError('NOT_CAPTAIN', 'Seul un capitaine de ce match peut agir');
    }
    return team.id;
  }
}
