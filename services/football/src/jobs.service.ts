import { Inject, Injectable, Logger } from '@nestjs/common';
import type { FootballJob, JobRunResult } from '@conexa/contracts';
import { sql } from 'kysely';

import { db } from './db.js';
import { pickMvpWinner } from './dispute.js';
import { MatchResultService } from './match-result.service.js';
import { OutboxService } from './outbox.service.js';
import { parseEvents } from './shared.js';
import { FOOTBALL_CLOCK } from './shared.js';
import {
  MVP_VOTE_WINDOW_HOURS,
  REPORT_DEADLINE_HOURS,
  shouldCancelForNoReport,
  shouldCloseContest,
  shouldProvisionalValidate,
} from './rules.js';

const HOUR_MS = 60 * 60 * 1000;
const BATCH = 50;

export interface JobOutcome {
  examined: number;
  changed: number;
}

/**
 * Travaux de clôture. Chaque travail est borné, relit l'état sous verrou et
 * n'écrit que sur une transition non encore faite : deux exécutions
 * successives donnent le même résultat (T-0031).
 */
@Injectable()
export class FootballJobsService {
  private readonly logger = new Logger(FootballJobsService.name);

  constructor(
    @Inject(FOOTBALL_CLOCK) private readonly now: () => Date,
    private readonly result: MatchResultService,
    private readonly outbox: OutboxService,
  ) {}

  async run(job: FootballJob): Promise<JobRunResult> {
    const at = this.now();
    const outcome = await this.execute(job);
    this.logger.log(`job=${job} examined=${outcome.examined} changed=${outcome.changed}`);
    return { job, examined: outcome.examined, changed: outcome.changed, at: at.toISOString() };
  }

  private async execute(job: FootballJob): Promise<JobOutcome> {
    switch (job) {
      case 'finalize_stale_reports':
        return this.finalizeStaleReports();
      case 'close_contest_windows':
        return this.closeContestWindows();
      case 'close_mvp_votes':
        return this.closeMvpVotes();
      case 'relay_outbox':
        return this.relayOutbox();
    }
  }

  /** H+24 après le coup d'envoi : une déclaration unique est validée, aucune annule. */
  async finalizeStaleReports(): Promise<JobOutcome> {
    const now = this.now();
    const deadline = new Date(now.getTime() - REPORT_DEADLINE_HOURS * HOUR_MS);
    const candidates = await db
      .selectFrom('matches')
      .select('id')
      .where('status', 'in', ['scheduled', 'awaiting_reports'])
      .where('starts_at', '<=', deadline)
      .orderBy('starts_at', 'asc')
      .limit(BATCH)
      .execute();

    let changed = 0;
    for (const candidate of candidates) {
      const did = await db.transaction().execute(async (trx) => {
        const match = await trx
          .selectFrom('matches')
          .selectAll()
          .where('id', '=', candidate.id)
          .forUpdate()
          .executeTakeFirst();
        if (!match || (match.status !== 'scheduled' && match.status !== 'awaiting_reports')) {
          return false;
        }

        const reports = await trx
          .selectFrom('match_reports')
          .selectAll()
          .where('match_id', '=', match.id)
          .orderBy('submitted_at', 'asc')
          .execute();

        if (
          shouldProvisionalValidate({ startsAt: match.starts_at, reports: reports.length, now })
        ) {
          const report = reports[0];
          if (!report) {
            return false;
          }
          const claimed = await trx
            .updateTable('matches')
            .set({ status: 'awaiting_reports' })
            .where('id', '=', match.id)
            .where('status', 'in', ['scheduled', 'awaiting_reports'])
            .executeTakeFirst();
          if (Number(claimed.numUpdatedRows) === 0) {
            return false;
          }
          await this.result.finalize(trx, match, {
            scoreA: report.score_a,
            scoreB: report.score_b,
            events: parseEvents(report.events),
            status: 'validated',
            provisional: true,
          });
          return true;
        }

        if (shouldCancelForNoReport({ startsAt: match.starts_at, reports: reports.length, now })) {
          const claimed = await trx
            .updateTable('matches')
            .set({ status: 'cancelled', cancelled_reason: 'no_report' })
            .where('id', '=', match.id)
            .where('status', 'in', ['scheduled', 'awaiting_reports'])
            .executeTakeFirst();
          return Number(claimed.numUpdatedRows) > 0;
        }

        return false;
      });
      if (did) {
        changed += 1;
      }
    }

    await this.relaySafely();
    return { examined: candidates.length, changed };
  }

  /** 48 h après la finalisation : la contestation n'est plus recevable. */
  async closeContestWindows(): Promise<JobOutcome> {
    const now = this.now();
    const threshold = new Date(now.getTime() - 48 * HOUR_MS);
    const candidates = await db
      .selectFrom('matches')
      .select(['id', 'finalized_at', 'contest_closed_at'])
      .where('status', 'in', ['validated', 'forfeited'])
      .where('finalized_at', 'is not', null)
      .where('finalized_at', '<=', threshold)
      .where('contest_closed_at', 'is', null)
      .orderBy('finalized_at', 'asc')
      .limit(BATCH)
      .execute();

    let changed = 0;
    for (const candidate of candidates) {
      if (
        !shouldCloseContest({
          finalizedAt: candidate.finalized_at,
          contestClosedAt: candidate.contest_closed_at,
          now,
        })
      ) {
        continue;
      }
      const updated = await db
        .updateTable('matches')
        .set({ contest_closed_at: now })
        .where('id', '=', candidate.id)
        .where('contest_closed_at', 'is', null)
        .executeTakeFirst();
      if (Number(updated.numUpdatedRows) > 0) {
        changed += 1;
      }
    }

    return { examined: candidates.length, changed };
  }

  /** 24 h après la validation (ADR 0008) : dépouillement unique du vote MVP. */
  async closeMvpVotes(): Promise<JobOutcome> {
    const now = this.now();
    const threshold = new Date(now.getTime() - MVP_VOTE_WINDOW_HOURS * HOUR_MS);
    const candidates = await db
      .selectFrom('matches')
      .select('id')
      .where('status', 'in', ['validated', 'forfeited'])
      .where('mvp_closed_at', 'is', null)
      .where('finalized_at', 'is not', null)
      .where('finalized_at', '<=', threshold)
      .orderBy('finalized_at', 'asc')
      .limit(BATCH)
      .execute();

    let changed = 0;
    for (const candidate of candidates) {
      const did = await db.transaction().execute(async (trx) => {
        const match = await trx
          .selectFrom('matches')
          .selectAll()
          .where('id', '=', candidate.id)
          .forUpdate()
          .executeTakeFirst();
        if (!match || match.mvp_closed_at) {
          return false;
        }

        const votes = await trx
          .selectFrom('mvp_votes')
          .select(['player_id'])
          .where('match_id', '=', match.id)
          .execute();
        const tally = new Map<string, number>();
        for (const vote of votes) {
          tally.set(vote.player_id, (tally.get(vote.player_id) ?? 0) + 1);
        }
        const winner = pickMvpWinner(
          [...tally].map(([player_id, count]) => ({ player_id, votes: count })),
        );

        const closed = await trx
          .updateTable('matches')
          .set({ mvp_user_id: winner, mvp_closed_at: now })
          .where('id', '=', match.id)
          .where('mvp_closed_at', 'is', null)
          .executeTakeFirst();
        if (Number(closed.numUpdatedRows) === 0) {
          return false;
        }

        if (winner) {
          const lineup = await trx
            .selectFrom('match_lineups')
            .select('team_id')
            .where('match_id', '=', match.id)
            .where('player_id', '=', winner)
            .executeTakeFirst();
          if (lineup) {
            await trx
              .updateTable('team_members')
              .set({ mvp_count: sql`mvp_count + 1` })
              .where('team_id', '=', lineup.team_id)
              .where('user_id', '=', winner)
              .execute();
          }
        }

        return true;
      });
      if (did) {
        changed += 1;
      }
    }

    return { examined: candidates.length, changed };
  }

  async relayOutbox(): Promise<JobOutcome> {
    return this.outbox.relay();
  }

  private async relaySafely(): Promise<void> {
    try {
      await this.outbox.relay();
    } catch {
      this.logger.warn('relais outbox reporté');
    }
  }
}
