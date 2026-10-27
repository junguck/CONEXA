import { Inject, Injectable } from '@nestjs/common';
import type { MatchReportInput, ReportStatus } from '@conexa/contracts';
import { AppError, forbidden, notFound } from '@conexa/errors';
import type { Kysely } from 'kysely';

import { db } from './db.js';
import type { FootballDb } from './db.js';
import { MatchResultService } from './match-result.service.js';
import type { MatchRow } from './matches.service.js';
import { MatchesService } from './matches.service.js';
import { OutboxService } from './outbox.service.js';
import { aggregateEvents, reconcile } from './report.js';
import { canCancelMatch, contestWindowOpen, mvpWindowOpen } from './rules.js';
import { FOOTBALL_CLOCK, parseEvents } from './shared.js';

@Injectable()
export class MatchReportService {
  constructor(
    @Inject(FOOTBALL_CLOCK) private readonly now: () => Date,
    private readonly matches: MatchesService,
    private readonly result: MatchResultService,
    private readonly outbox: OutboxService,
  ) {}

  /** Déclaration d'un capitaine ; la seconde déclaration clôt le match. */
  async report(
    userId: string,
    matchId: string,
    input: MatchReportInput,
  ): Promise<{ status: ReportStatus }> {
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
          .where('status', 'in', ['scheduled', 'awaiting_reports'])
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
          .where('status', 'in', ['scheduled', 'awaiting_reports'])
          .execute();
        await this.outbox.enqueue(trx, [
          {
            type: 'match.disputed',
            payload: {
              match_id: match.id,
              home_team_id: match.home_team_id,
              away_team_id: match.away_team_id,
            },
          },
        ]);
        return 'disputed';
      }

      await this.result.finalize(trx, match, {
        scoreA: first.score_a,
        scoreB: first.score_b,
        events: parseEvents(first.events),
        status: 'validated',
      });

      return 'validated';
    });

    await this.relayQuietly();
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
      const updated = await trx
        .updateTable('matches')
        .set({ status: 'cancelled', cancelled_reason: reason })
        .where('id', '=', matchId)
        .where('status', 'in', ['scheduled', 'awaiting_reports'])
        .executeTakeFirst();
      if (Number(updated.numUpdatedRows) === 0) {
        throw new AppError('INVALID_STATE', 'Ce match a changé d’état entre-temps');
      }
      await trx.deleteFrom('field_bookings').where('match_id', '=', matchId).execute();
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
      const updated = await trx
        .updateTable('matches')
        .set({ status: 'disputed', contest_closed_at: null })
        .where('id', '=', matchId)
        .where('status', '=', 'validated')
        .executeTakeFirst();
      if (Number(updated.numUpdatedRows) === 0) {
        throw new AppError('INVALID_STATE', 'Ce match a changé d’état entre-temps');
      }
      await this.outbox.enqueue(trx, [
        {
          type: 'match.disputed',
          payload: {
            match_id: match.id,
            home_team_id: match.home_team_id,
            away_team_id: match.away_team_id,
          },
        },
      ]);
    });

    await this.relayQuietly();
  }

  /**
   * Vote MVP ouvert 24 h (ADR 0008) : le vote est enregistré, le dépouillement
   * et l'incrément de `mvp_count` sont faits une seule fois par la clôture.
   */
  async voteMvp(userId: string, matchId: string, playerId: string): Promise<void> {
    const match = await this.matches.findMatch(matchId);
    if (match.status !== 'validated' && match.status !== 'forfeited') {
      throw new AppError('INVALID_STATE', 'Le vote MVP ouvre après la validation du match');
    }
    if (match.mvp_closed_at || !mvpWindowOpen(match.finalized_at, this.now())) {
      throw new AppError('INVALID_STATE', 'La fenêtre de vote du MVP de 24 h est fermée');
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
  }

  /** Forfait déclaré par un capitaine : victoire 3-0 sur tapis vert. */
  async forfeit(userId: string, matchId: string): Promise<void> {
    const match = await this.matches.findMatch(matchId);
    const teamId = await this.teamOfCaptain(db, match, userId);
    if (match.status !== 'scheduled' && match.status !== 'awaiting_reports') {
      throw new AppError('INVALID_STATE', 'Ce match ne peut plus être déclaré forfait');
    }

    await db.transaction().execute(async (trx) => {
      const isHome = teamId === match.home_team_id;
      await this.result.finalize(trx, match, {
        scoreA: isHome ? 3 : 0,
        scoreB: isHome ? 0 : 3,
        events: [],
        status: 'forfeited',
      });
    });

    await this.relayQuietly();
  }

  /** Totalise les buts d'un joueur sur le match (dépouillement et correction admin). */
  async goalTally(matchId: string): Promise<Map<string, number>> {
    const events = await db
      .selectFrom('match_events')
      .select(['player_id', 'type'])
      .where('match_id', '=', matchId)
      .execute();
    return aggregateEvents(
      events.map((event) => ({
        type: event.type,
        minute: 1,
        player_id: event.player_id,
      })),
    ).goals;
  }

  // --- internes ---------------------------------------------------------

  private async relayQuietly(): Promise<void> {
    try {
      await this.outbox.relay();
    } catch {
      // Le résultat sportif est déjà commité : l'outbox reprendra au prochain relais.
    }
  }

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
