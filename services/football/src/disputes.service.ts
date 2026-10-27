import { Inject, Injectable } from '@nestjs/common';
import type { DisputeDetail, ResolveDisputeInput } from '@conexa/contracts';
import { AppError, notFound } from '@conexa/errors';
import type { Selectable } from 'kysely';

import { db } from './db.js';
import type { MatchesTable } from './db.js';
import { arbitrationPlan } from './dispute.js';
import { MatchResultService } from './match-result.service.js';
import { OutboxService } from './outbox.service.js';
import { FOOTBALL_CLOCK, parseEvents } from './shared.js';

type MatchRow = Selectable<MatchesTable>;

@Injectable()
export class DisputesService {
  constructor(
    @Inject(FOOTBALL_CLOCK) private readonly now: () => Date,
    private readonly result: MatchResultService,
    private readonly outbox: OutboxService,
  ) {}

  async list(): Promise<{ data: DisputeDetail[] }> {
    const matches = await db
      .selectFrom('matches')
      .selectAll()
      .where('status', '=', 'disputed')
      .orderBy('starts_at', 'asc')
      .limit(100)
      .execute();

    const ids = matches.map((match) => match.id);
    const [reports, contests] = await Promise.all([
      ids.length === 0
        ? []
        : db.selectFrom('match_reports').selectAll().where('match_id', 'in', ids).execute(),
      ids.length === 0
        ? []
        : db.selectFrom('match_contests').selectAll().where('match_id', 'in', ids).execute(),
    ]);

    return { data: matches.map((match) => this.toDetail(match, reports, contests)) };
  }

  async detail(matchId: string): Promise<DisputeDetail> {
    const match = await db
      .selectFrom('matches')
      .selectAll()
      .where('id', '=', matchId)
      .executeTakeFirst();
    if (!match) {
      throw notFound('Match');
    }
    if (match.status !== 'disputed') {
      throw new AppError('INVALID_STATE', 'Ce match n’est pas en litige');
    }

    const [reports, contests] = await Promise.all([
      db.selectFrom('match_reports').selectAll().where('match_id', '=', matchId).execute(),
      db.selectFrom('match_contests').selectAll().where('match_id', '=', matchId).execute(),
    ]);
    return this.toDetail(match, reports, contests);
  }

  /**
   * Tranche un litige. Le match passe d'abord par une transition SQL protégée
   * (`where status = 'disputed'`), puis l'Elo et les statistiques sont
   * réappliqués une seule fois si le match avait déjà été finalisé.
   */
  async resolve(
    adminId: string,
    matchId: string,
    input: ResolveDisputeInput,
  ): Promise<DisputeDetail> {
    await db.transaction().execute(async (trx) => {
      const match = await trx
        .selectFrom('matches')
        .selectAll()
        .where('id', '=', matchId)
        .forUpdate()
        .executeTakeFirst();
      if (!match) {
        throw notFound('Match');
      }

      const arbitration = arbitrationPlan({
        status: match.status,
        finalizedAt: match.finalized_at,
        decision: input.decision,
        scoreA: input.score_a,
        scoreB: input.score_b,
      });

      // Transition protégée : un seul arbitrage peut réclamer le litige.
      const claimed = await trx
        .updateTable('matches')
        .set(
          arbitration.nextStatus === 'validated'
            ? { status: 'awaiting_reports' }
            : { status: 'cancelled', cancelled_reason: `admin: ${input.reason}` },
        )
        .where('id', '=', matchId)
        .where('status', '=', 'disputed')
        .executeTakeFirst();
      if (Number(claimed.numUpdatedRows) === 0) {
        throw new AppError('INVALID_STATE', 'Ce litige a déjà été tranché');
      }

      if (arbitration.revert) {
        await this.result.reverse(trx, match);
      }

      if (arbitration.apply) {
        await this.result.finalize(trx, match, {
          scoreA: arbitration.apply.scoreA,
          scoreB: arbitration.apply.scoreB,
          events: input.events,
          status: 'validated',
        });
        await trx
          .updateTable('matches')
          .set({ contest_closed_at: this.now(), provisional: false })
          .where('id', '=', matchId)
          .execute();
      }

      await trx
        .insertInto('match_adjudications')
        .values({
          match_id: matchId,
          admin_id: adminId,
          decision: input.decision,
          score_a: input.score_a ?? null,
          score_b: input.score_b ?? null,
          reason: input.reason,
          evidence_upload_ids: input.evidence_upload_ids,
        })
        .execute();
    });

    try {
      await this.outbox.relay();
    } catch {
      // L'outbox reprend au prochain relais ; l'arbitrage est déjà commité.
    }

    const detail = await this.detailAfterResolution(matchId);
    return detail;
  }

  private async detailAfterResolution(matchId: string): Promise<DisputeDetail> {
    const match = await db
      .selectFrom('matches')
      .selectAll()
      .where('id', '=', matchId)
      .executeTakeFirstOrThrow();
    const [reports, contests] = await Promise.all([
      db.selectFrom('match_reports').selectAll().where('match_id', '=', matchId).execute(),
      db.selectFrom('match_contests').selectAll().where('match_id', '=', matchId).execute(),
    ]);
    return this.toDetail(match, reports, contests);
  }

  private toDetail(
    match: MatchRow,
    reports: Array<{
      match_id: string;
      team_id: string;
      submitted_by: string;
      score_a: number;
      score_b: number;
      events: unknown;
      submitted_at: Date;
    }>,
    contests: Array<{
      match_id: string;
      team_id: string;
      reason: string;
      evidence_upload_ids: string[];
      created_at: Date;
    }>,
  ): DisputeDetail {
    return {
      id: match.id,
      home_team_id: match.home_team_id,
      away_team_id: match.away_team_id,
      field_id: match.field_id,
      starts_at: match.starts_at.toISOString(),
      status: match.status,
      score_a: match.score_a,
      score_b: match.score_b,
      mvp_user_id: match.mvp_user_id,
      finalized_at: match.finalized_at ? match.finalized_at.toISOString() : null,
      provisional: match.provisional,
      source: contests.some((contest) => contest.match_id === match.id) ? 'contest' : 'reports',
      reports: reports
        .filter((report) => report.match_id === match.id)
        .map((report) => ({
          team_id: report.team_id,
          submitted_by: report.submitted_by,
          score_a: report.score_a,
          score_b: report.score_b,
          events: parseEvents(report.events),
          submitted_at: report.submitted_at.toISOString(),
        })),
      contests: contests
        .filter((contest) => contest.match_id === match.id)
        .map((contest) => ({
          team_id: contest.team_id,
          reason: contest.reason,
          evidence_upload_ids: contest.evidence_upload_ids,
          created_at: contest.created_at.toISOString(),
        })),
    };
  }
}
