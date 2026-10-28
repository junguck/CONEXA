import { Inject, Injectable } from '@nestjs/common';
import type { MatchEvent } from '@conexa/contracts';
import { sql, type Kysely } from 'kysely';

import type { FootballDb } from './db.js';
import { correctedElo, correctedMatchesPlayed } from './dispute.js';
import { applyResult, levelFor } from './elo.js';
import type { MatchRow } from './matches.service.js';
import { OutboxService } from './outbox.service.js';
import { aggregateEvents, badgesForMatch } from './report.js';
import { FOOTBALL_CLOCK } from './shared.js';

export interface FinalizeInput {
  scoreA: number;
  scoreB: number;
  events: MatchEvent[];
  status: 'validated' | 'forfeited';
  /** Vrai quand une seule déclaration a été acceptée faute de seconde. */
  provisional?: boolean;
}

/**
 * Seul endroit qui écrit l'Elo, les statistiques et les événements d'un résultat.
 * `reverse` retire exactement ce que `finalize` a appliqué, sans écraser les
 * matchs validés depuis (arbitrage d'un match contesté, correction admin).
 */
@Injectable()
export class MatchResultService {
  constructor(
    @Inject(FOOTBALL_CLOCK) private readonly now: () => Date,
    private readonly outbox: OutboxService,
  ) {}

  async finalize(
    trx: Kysely<FootballDb>,
    match: MatchRow,
    input: FinalizeInput,
  ): Promise<{ home: number; away: number }> {
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
        provisional: input.provisional ?? false,
      })
      .where('id', '=', match.id)
      .execute();

    if (input.events.length > 0) {
      const lineups = await trx
        .selectFrom('match_lineups')
        .select(['team_id', 'player_id'])
        .where('match_id', '=', match.id)
        .execute();
      const teamOfPlayer = new Map(lineups.map((row) => [row.player_id, row.team_id]));

      await trx
        .insertInto('match_events')
        .values(
          input.events.map((event) => ({
            match_id: match.id,
            team_id: teamOfPlayer.get(event.player_id) ?? match.home_team_id,
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

    await this.outbox.enqueue(trx, [
      {
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
      },
    ]);

    return { home: elo.home, away: elo.away };
  }

  /** Retire le résultat précédent (Elo, journal, statistiques, MVP) une seule fois. */
  async reverse(trx: Kysely<FootballDb>, match: MatchRow): Promise<void> {
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

    const corrections: Array<{ id: string; elo: number; played: number }> = [
      {
        id: home.id,
        elo: correctedElo({
          current: home.elo,
          before: match.elo_home_before,
          after: match.elo_home_after,
        }),
        played: correctedMatchesPlayed(home.matches_played),
      },
      {
        id: away.id,
        elo: correctedElo({
          current: away.elo,
          before: match.elo_away_before,
          after: match.elo_away_after,
        }),
        played: correctedMatchesPlayed(away.matches_played),
      },
    ];
    for (const correction of corrections) {
      await trx
        .updateTable('teams')
        .set({
          elo: correction.elo,
          matches_played: correction.played,
          level: levelFor(correction.elo, correction.played),
          updated_at: now,
        })
        .where('id', '=', correction.id)
        .execute();
    }

    await trx.deleteFrom('elo_history').where('match_id', '=', match.id).execute();

    const lineups = await trx
      .selectFrom('match_lineups')
      .selectAll()
      .where('match_id', '=', match.id)
      .execute();
    for (const row of lineups) {
      await trx
        .updateTable('team_members')
        .set({ matches: sql`greatest(0, matches - 1)` })
        .where('team_id', '=', row.team_id)
        .where('user_id', '=', row.player_id)
        .execute();
    }

    const stored = await trx
      .selectFrom('match_events')
      .select(['player_id', 'type', 'related_player_id'])
      .where('match_id', '=', match.id)
      .execute();
    for (const event of stored) {
      if (event.type === 'goal') {
        await trx
          .updateTable('team_members')
          .set({ goals: sql`greatest(0, goals - 1)` })
          .where('user_id', '=', event.player_id)
          .execute();
        if (event.related_player_id) {
          await trx
            .updateTable('team_members')
            .set({ assists: sql`greatest(0, assists - 1)` })
            .where('user_id', '=', event.related_player_id)
            .execute();
        }
      }
      if (event.type === 'assist') {
        await trx
          .updateTable('team_members')
          .set({ assists: sql`greatest(0, assists - 1)` })
          .where('user_id', '=', event.player_id)
          .execute();
      }
    }
    await trx.deleteFrom('match_events').where('match_id', '=', match.id).execute();

    if (match.mvp_closed_at && match.mvp_user_id) {
      await trx
        .updateTable('team_members')
        .set({ mvp_count: sql`greatest(0, mvp_count - 1)` })
        .where('user_id', '=', match.mvp_user_id)
        .execute();
    }

    await trx
      .updateTable('matches')
      .set({
        score_a: null,
        score_b: null,
        mvp_user_id: null,
        mvp_closed_at: null,
        elo_home_before: null,
        elo_away_before: null,
        elo_home_after: null,
        elo_away_after: null,
        finalized_at: null,
        provisional: false,
        contest_closed_at: null,
      })
      .where('id', '=', match.id)
      .execute();
  }
}
