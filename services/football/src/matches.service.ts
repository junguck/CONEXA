import { Inject, Injectable } from '@nestjs/common';
import type {
  Challenge,
  CreateChallengeInput,
  MatchDetail,
  MatchSearchQuery,
} from '@conexa/contracts';
import type { EventPublisher } from '@conexa/events';
import { createEvent } from '@conexa/events';
import { AppError, forbidden, notFound, validationError } from '@conexa/errors';
import type { Selectable } from 'kysely';

import { db } from './db.js';
import {
  FOOTBALL_CLOCK,
  FOOTBALL_EVENTS,
  decodePageCursor,
  encodePageCursor,
  isUniqueViolation,
  type TeamRow,
} from './shared.js';
import { TeamsService } from './teams.service.js';
import type { ChallengesTable, MatchesTable } from './db.js';

export type MatchRow = Selectable<MatchesTable>;
export type ChallengeRow = Selectable<ChallengesTable>;

export const MATCH_DURATION_MINUTES = 90;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function toChallenge(row: ChallengeRow): Challenge {
  return {
    id: row.id,
    from_team_id: row.from_team_id,
    to_team_id: row.to_team_id,
    field_id: row.field_id,
    proposed_at: row.proposed_at.toISOString(),
    status: row.status,
    created_at: row.created_at.toISOString(),
  };
}

@Injectable()
export class MatchesService {
  constructor(
    @Inject(FOOTBALL_CLOCK) private readonly now: () => Date,
    @Inject(FOOTBALL_EVENTS) private readonly bus: EventPublisher,
    private readonly teams: TeamsService,
  ) {}

  // --- défis -------------------------------------------------------------

  async createChallenge(userId: string, input: CreateChallengeInput): Promise<Challenge> {
    const proposedAt = new Date(input.proposed_at);
    if (proposedAt.getTime() <= this.now().getTime()) {
      throw validationError('Le créneau proposé doit être dans le futur');
    }

    const from = await this.requireActiveCaptain(userId);
    const to = await this.teams.findTeam(input.to_team_id);
    if (to.status !== 'active') {
      throw new AppError('TEAM_NOT_ACTIVE', 'L’équipe adverse n’est pas active');
    }
    if (to.id === from.id) {
      throw validationError('Une équipe ne peut pas se défier elle-même');
    }
    await this.assertFieldExists(input.field_id);
    await this.assertSlotFree(input.field_id, proposedAt);

    const row = await db
      .insertInto('challenges')
      .values({
        from_team_id: from.id,
        to_team_id: to.id,
        field_id: input.field_id,
        proposed_at: proposedAt,
        created_by: userId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toChallenge(row);
  }

  async listChallenges(
    userId: string,
    box: 'sent' | 'received',
    status?: string,
  ): Promise<Challenge[]> {
    const teamId = await this.captainTeamId(userId);
    let select = db.selectFrom('challenges').selectAll();

    select =
      box === 'sent'
        ? select.where('from_team_id', '=', teamId)
        : select.where('to_team_id', '=', teamId);
    if (status) {
      select = select.where('status', '=', status as ChallengeRow['status']);
    }

    const rows = await select.orderBy('created_at', 'desc').limit(50).execute();
    return rows.map(toChallenge);
  }

  async acceptChallenge(captainId: string, challengeId: string): Promise<{ match_id: string }> {
    const challenge = await this.findChallenge(challengeId);
    if (challenge.status !== 'pending') {
      throw new AppError('INVALID_STATE', 'Ce défi n’est plus en attente');
    }
    if (this.now().getTime() > challenge.proposed_at.getTime()) {
      throw new AppError('INVALID_STATE', 'Le créneau proposé est passé');
    }
    await this.teams.requireCaptain(challenge.to_team_id, captainId);
    await this.assertFieldExists(challenge.field_id);
    await this.assertSlotFree(challenge.field_id, challenge.proposed_at);

    const match = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('matches')
        .values({
          challenge_id: challenge.id,
          home_team_id: challenge.from_team_id,
          away_team_id: challenge.to_team_id,
          field_id: challenge.field_id,
          starts_at: challenge.proposed_at,
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();

      try {
        await trx
          .insertInto('field_bookings')
          .values({
            field_id: challenge.field_id,
            starts_at: challenge.proposed_at,
            ends_at: addMinutes(challenge.proposed_at, MATCH_DURATION_MINUTES),
            match_id: created.id,
          })
          .execute();
      } catch (error) {
        if (isUniqueViolation(error, 'field_bookings')) {
          throw new AppError('FIELD_SLOT_TAKEN', 'Ce créneau vient d’être réservé');
        }
        throw error;
      }

      await trx
        .updateTable('challenges')
        .set({ status: 'accepted', resolved_at: this.now() })
        .where('id', '=', challenge.id)
        .execute();

      return created;
    });

    await this.bus.publish([
      createEvent({
        type: 'match.scheduled',
        producer: 'football',
        payload: {
          match_id: match.id,
          home_team_id: challenge.from_team_id,
          away_team_id: challenge.to_team_id,
          starts_at: challenge.proposed_at.toISOString(),
        },
      }),
    ]);

    return { match_id: match.id };
  }

  async declineChallenge(captainId: string, challengeId: string): Promise<void> {
    const challenge = await this.findChallenge(challengeId);
    await this.teams.requireCaptain(challenge.to_team_id, captainId);
    await this.closeChallenge(challenge, 'declined');
  }

  async cancelChallenge(userId: string, challengeId: string): Promise<void> {
    const challenge = await this.findChallenge(challengeId);
    await this.teams.requireCaptain(challenge.from_team_id, userId);
    await this.closeChallenge(challenge, 'cancelled');
  }

  /** Contre-proposition : l'équipe qui reçoit défie l'autre sur un nouveau créneau. */
  async counterChallenge(
    captainId: string,
    challengeId: string,
    input: { field_id: string; proposed_at: string },
  ): Promise<Challenge> {
    const challenge = await this.findChallenge(challengeId);
    await this.teams.requireCaptain(challenge.to_team_id, captainId);
    const proposedAt = new Date(input.proposed_at);
    if (proposedAt.getTime() <= this.now().getTime()) {
      throw validationError('Le créneau proposé doit être dans le futur');
    }
    await this.assertFieldExists(input.field_id);
    await this.assertSlotFree(input.field_id, proposedAt);

    const row = await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('challenges')
        .set({ status: 'countered', resolved_at: this.now() })
        .where('id', '=', challenge.id)
        .execute();
      return trx
        .insertInto('challenges')
        .values({
          from_team_id: challenge.to_team_id,
          to_team_id: challenge.from_team_id,
          field_id: input.field_id,
          proposed_at: proposedAt,
          parent_id: challenge.id,
          created_by: captainId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });

    return toChallenge(row);
  }

  // --- matchs ------------------------------------------------------------

  async listMatches(query: MatchSearchQuery): Promise<{
    data: Array<{
      id: string;
      home_team_id: string;
      away_team_id: string;
      field_id: string;
      starts_at: string;
      status: MatchRow['status'];
      score_a: number | null;
      score_b: number | null;
      mvp_user_id: string | null;
    }>;
    next_cursor: string | null;
  }> {
    let select = db.selectFrom('matches').selectAll();
    if (query.status) {
      select = select.where('status', '=', query.status);
    }
    if (query.team_id) {
      select = select.where((eb) =>
        eb.or([
          eb('home_team_id', '=', query.team_id as string),
          eb('away_team_id', '=', query.team_id as string),
        ]),
      );
    }
    if (query.from) {
      select = select.where('starts_at', '>=', new Date(query.from));
    }
    if (query.to) {
      select = select.where('starts_at', '<=', new Date(query.to));
    }
    if (query.cursor) {
      select = select.where('starts_at', '<', new Date(decodePageCursor(query.cursor)));
    }

    const rows = await select
      .orderBy('starts_at', 'desc')
      .limit(query.limit + 1)
      .execute();
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);

    return {
      data: page.map((row) => ({
        id: row.id,
        home_team_id: row.home_team_id,
        away_team_id: row.away_team_id,
        field_id: row.field_id,
        starts_at: row.starts_at.toISOString(),
        status: row.status,
        score_a: row.score_a,
        score_b: row.score_b,
        mvp_user_id: row.mvp_user_id,
      })),
      next_cursor:
        rows.length > query.limit && last ? encodePageCursor(last.starts_at.toISOString()) : null,
    };
  }

  async matchDetail(matchId: string): Promise<MatchDetail> {
    const match = await this.findMatch(matchId);
    const [events, lineups] = await Promise.all([
      db.selectFrom('match_events').selectAll().where('match_id', '=', matchId).execute(),
      db.selectFrom('match_lineups').selectAll().where('match_id', '=', matchId).execute(),
    ]);

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
      events: events.map((event) => ({
        type: event.type,
        minute: event.minute,
        player_id: event.player_id,
        ...(event.related_player_id ? { related_player_id: event.related_player_id } : {}),
      })),
      lineups: [
        {
          team_id: match.home_team_id,
          player_ids: lineups
            .filter((row) => row.team_id === match.home_team_id)
            .map((row) => row.player_id),
        },
        {
          team_id: match.away_team_id,
          player_ids: lineups
            .filter((row) => row.team_id === match.away_team_id)
            .map((row) => row.player_id),
        },
      ],
    };
  }

  // --- helpers internes -------------------------------------------------

  async findMatch(matchId: string): Promise<MatchRow> {
    const row = await db
      .selectFrom('matches')
      .selectAll()
      .where('id', '=', matchId)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Match');
    }
    return row;
  }

  async findChallenge(challengeId: string): Promise<ChallengeRow> {
    const row = await db
      .selectFrom('challenges')
      .selectAll()
      .where('id', '=', challengeId)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Défi');
    }
    return row;
  }

  async requireActiveCaptain(userId: string): Promise<TeamRow> {
    const membership = await this.teams.activeMembership(userId);
    if (!membership || membership.role !== 'captain') {
      throw new AppError('NOT_CAPTAIN', 'Seul un capitaine peut défier une équipe');
    }
    const team = await this.teams.findTeam(membership.team_id);
    if (team.status !== 'active') {
      throw new AppError('TEAM_NOT_ACTIVE', 'Ton équipe n’est plus active');
    }
    return team;
  }

  async captainTeamId(userId: string): Promise<string> {
    const membership = await this.teams.activeMembership(userId);
    if (!membership) {
      throw forbidden('Tu n’as pas d’équipe');
    }
    return membership.team_id;
  }

  async assertFieldExists(fieldId: string): Promise<void> {
    const field = await db
      .selectFrom('fields')
      .select('id')
      .where('id', '=', fieldId)
      .executeTakeFirst();
    if (!field) {
      throw notFound('Terrain');
    }
  }

  async assertSlotFree(fieldId: string, startsAt: Date): Promise<void> {
    const booking = await db
      .selectFrom('field_bookings')
      .select('id')
      .where('field_id', '=', fieldId)
      .where('starts_at', '=', startsAt)
      .executeTakeFirst();
    if (booking) {
      throw new AppError('FIELD_SLOT_TAKEN', 'Ce créneau est déjà réservé');
    }
  }

  private async closeChallenge(
    challenge: ChallengeRow,
    status: 'declined' | 'cancelled',
  ): Promise<void> {
    if (challenge.status !== 'pending') {
      throw new AppError('INVALID_STATE', 'Ce défi n’est plus en attente');
    }
    await db
      .updateTable('challenges')
      .set({ status, resolved_at: this.now() })
      .where('id', '=', challenge.id)
      .execute();
  }
}
