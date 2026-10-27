import { Injectable } from '@nestjs/common';
import type {
  BracketSlot,
  Competition,
  CompetitionSearchQuery,
  CompetitionStandingRow,
  CompetitionTeam,
  CreateCompetitionInput,
  GenerateBracketInput,
  GenerateGroupsInput,
} from '@conexa/contracts';
import { AppError, notFound } from '@conexa/errors';
import type { Selectable } from 'kysely';

import { db } from './db.js';
import type { CompetitionsTable } from './db.js';
import { buildBracket, distributeIntoGroups, nextStageSlot, standingsFor } from './competitions.js';
import { resolveKnockoutWinner } from './dispute.js';

type CompetitionRow = Selectable<CompetitionsTable>;

@Injectable()
export class CompetitionsService {
  async create(userId: string, input: CreateCompetitionInput): Promise<Competition> {
    const row = await db
      .insertInto('competitions')
      .values({
        name: input.name,
        format: input.format,
        starts_at: new Date(input.starts_at),
        created_by: userId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toCompetition(row);
  }

  async list(query: CompetitionSearchQuery): Promise<Competition[]> {
    let select = db.selectFrom('competitions').selectAll();
    if (query.status !== 'all') {
      select = select.where('status', '=', query.status);
    }
    const rows = await select.orderBy('starts_at', 'desc').limit(100).execute();
    return rows.map(toCompetition);
  }

  async get(competitionId: string): Promise<Competition> {
    const row = await db
      .selectFrom('competitions')
      .selectAll()
      .where('id', '=', competitionId)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Compétition');
    }
    return toCompetition(row);
  }

  async teams(competitionId: string): Promise<{ data: CompetitionTeam[] }> {
    await this.get(competitionId);
    const rows = await db
      .selectFrom('competition_teams')
      .selectAll()
      .where('competition_id', '=', competitionId)
      .orderBy('joined_at', 'asc')
      .execute();
    return {
      data: rows.map((row) => ({
        competition_id: row.competition_id,
        team_id: row.team_id,
        group_no: row.group_no,
        joined_at: row.joined_at.toISOString(),
      })),
    };
  }

  /** Une compétition n'accueille que des équipes actives, une fois chacune. */
  async registerTeam(competitionId: string, teamId: string): Promise<CompetitionTeam> {
    const competition = await this.get(competitionId);
    if (competition.status === 'finished') {
      throw new AppError('INVALID_STATE', 'Cette compétition est terminée');
    }
    const team = await db
      .selectFrom('teams')
      .select(['id', 'status'])
      .where('id', '=', teamId)
      .executeTakeFirst();
    if (!team) {
      throw notFound('Équipe');
    }
    if (team.status !== 'active') {
      throw new AppError('TEAM_NOT_ACTIVE', 'L’équipe doit être active pour s’inscrire');
    }

    const inserted = await db
      .insertInto('competition_teams')
      .values({ competition_id: competitionId, team_id: teamId })
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst();
    if (!inserted) {
      throw new AppError('INVALID_STATE', 'Cette équipe est déjà inscrite');
    }
    return {
      competition_id: inserted.competition_id,
      team_id: inserted.team_id,
      group_no: inserted.group_no,
      joined_at: inserted.joined_at.toISOString(),
    };
  }

  async standings(
    competitionId: string,
    groupNo?: number,
  ): Promise<{ data: CompetitionStandingRow[] }> {
    await this.get(competitionId);
    const [teams, matches] = await Promise.all([
      db
        .selectFrom('competition_teams')
        .select(['team_id', 'group_no'])
        .where('competition_id', '=', competitionId)
        .execute(),
      db
        .selectFrom('matches')
        .select(['home_team_id', 'away_team_id', 'score_a', 'score_b', 'status'])
        .where('competition_id', '=', competitionId)
        .execute(),
    ]);

    const groups = Object.fromEntries(
      teams.flatMap((team) => (team.group_no === null ? [] : [[team.team_id, team.group_no]])),
    ) as Record<string, number>;

    return {
      data: standingsFor(
        teams.map((team) => team.team_id),
        matches,
        groupNo ?? null,
        groups,
      ),
    };
  }

  /** Tire les poules : répartition en serpentin sur les équipes inscrites. */
  async generateGroups(
    competitionId: string,
    input: GenerateGroupsInput,
  ): Promise<{ data: CompetitionTeam[] }> {
    const competition = await this.get(competitionId);
    if (competition.status === 'finished') {
      throw new AppError('INVALID_STATE', 'Cette compétition est terminée');
    }
    const teams = await db
      .selectFrom('competition_teams')
      .select('team_id')
      .where('competition_id', '=', competitionId)
      .execute();
    const groups = distributeIntoGroups(
      teams.map((team) => team.team_id),
      input.groups,
    );

    await db.transaction().execute(async (trx) => {
      for (const [index, members] of groups.entries()) {
        if (members.length === 0) {
          continue;
        }
        await trx
          .updateTable('competition_teams')
          .set({ group_no: index + 1 })
          .where('competition_id', '=', competitionId)
          .where('team_id', 'in', members)
          .execute();
      }
      await trx
        .updateTable('competitions')
        .set({ status: 'active' })
        .where('id', '=', competitionId)
        .where('status', 'in', ['draft', 'active'])
        .execute();
    });

    return this.teams(competitionId);
  }

  async bracket(competitionId: string): Promise<{ data: BracketSlot[] }> {
    await this.get(competitionId);
    const rows = await db
      .selectFrom('competition_slots')
      .selectAll()
      .where('competition_id', '=', competitionId)
      .where('stage', '!=', 'group')
      .orderBy('stage', 'asc')
      .orderBy('position', 'asc')
      .execute();
    return { data: rows.map(toBracketSlot) };
  }

  /** Crée l'arbre à élimination directe et place les équipes inscrites. */
  async generateBracket(
    competitionId: string,
    input: GenerateBracketInput,
  ): Promise<{ data: BracketSlot[] }> {
    await this.get(competitionId);
    const teams = await db
      .selectFrom('competition_teams')
      .select('team_id')
      .where('competition_id', '=', competitionId)
      .orderBy('joined_at', 'asc')
      .execute();
    if (teams.length !== input.size) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Le tableau de ${input.size} places exige exactement ${input.size} équipes inscrites`,
      );
    }

    const teamIds = teams.map((team) => team.team_id);
    const bracket = buildBracket(input.size);
    const firstStage = bracket[0]?.stage;
    await db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('competition_slots')
        .where('competition_id', '=', competitionId)
        .where('stage', '!=', 'group')
        .execute();
      await trx
        .insertInto('competition_slots')
        .values(
          bracket.map((slot) => {
            const start = (slot.position - 1) * 2;
            const seeded = slot.stage === firstStage;
            return {
              competition_id: competitionId,
              stage: slot.stage,
              position: slot.position,
              home_team_id: seeded ? (teamIds[start] ?? null) : null,
              away_team_id: seeded ? (teamIds[start + 1] ?? null) : null,
            };
          }),
        )
        .execute();
      await trx
        .updateTable('competitions')
        .set({ status: 'active' })
        .where('id', '=', competitionId)
        .where('status', 'in', ['draft', 'active'])
        .execute();
    });

    return this.bracket(competitionId);
  }

  /** Rattache un match existant à une place du tableau (admin). */
  async attachMatch(competitionId: string, slotId: string, matchId: string): Promise<BracketSlot> {
    await this.get(competitionId);
    const match = await db
      .selectFrom('matches')
      .select(['id', 'status'])
      .where('id', '=', matchId)
      .executeTakeFirst();
    if (!match) {
      throw notFound('Match');
    }
    if (
      match.status === 'validated' ||
      match.status === 'forfeited' ||
      match.status === 'cancelled'
    ) {
      throw new AppError('INVALID_STATE', 'Ce match est déjà terminé');
    }

    const updated = await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('matches')
        .set({ competition_id: competitionId })
        .where('id', '=', matchId)
        .execute();
      const row = await trx
        .updateTable('competition_slots')
        .set({ match_id: matchId })
        .where('id', '=', slotId)
        .where('competition_id', '=', competitionId)
        .where('match_id', 'is', null)
        .returningAll()
        .executeTakeFirst();
      if (!row) {
        throw new AppError('INVALID_STATE', 'Cette place est déjà occupée par un match');
      }
      return row;
    });

    return toBracketSlot(updated);
  }

  /**
   * Avance le vainqueur d'un match validé vers la place suivante. Idempotent :
   * une place déjà décidée refuse le second passage.
   */
  async advance(competitionId: string, matchId: string): Promise<{ data: BracketSlot[] }> {
    await this.get(competitionId);
    await db.transaction().execute(async (trx) => {
      const slot = await trx
        .selectFrom('competition_slots')
        .selectAll()
        .where('competition_id', '=', competitionId)
        .where('match_id', '=', matchId)
        .forUpdate()
        .executeTakeFirst();
      if (!slot) {
        throw notFound('Place de tableau');
      }
      if (slot.winner_team_id) {
        throw new AppError('INVALID_STATE', 'Cette place est déjà décidée');
      }
      const match = await trx
        .selectFrom('matches')
        .select(['id', 'home_team_id', 'away_team_id', 'score_a', 'score_b', 'status'])
        .where('id', '=', matchId)
        .executeTakeFirst();
      if (!match) {
        throw notFound('Match');
      }
      if (match.status !== 'validated' && match.status !== 'forfeited') {
        throw new AppError('INVALID_STATE', 'Le match doit être terminé pour avancer');
      }
      const winner = resolveKnockoutWinner({
        homeTeamId: match.home_team_id,
        awayTeamId: match.away_team_id,
        scoreA: match.score_a,
        scoreB: match.score_b,
      });
      if (!winner) {
        throw new AppError('INVALID_STATE', 'Un match nul ne désigne pas de vainqueur');
      }

      const claimed = await trx
        .updateTable('competition_slots')
        .set({ winner_team_id: winner })
        .where('id', '=', slot.id)
        .where('winner_team_id', 'is', null)
        .executeTakeFirst();
      if (Number(claimed.numUpdatedRows) === 0) {
        throw new AppError('INVALID_STATE', 'Cette place est déjà décidée');
      }

      const next = nextStageSlot({ stage: slot.stage, position: slot.position });
      if (!next) {
        await trx
          .updateTable('competitions')
          .set({ status: 'finished', ends_at: new Date() })
          .where('id', '=', competitionId)
          .execute();
        return;
      }

      const nextSlot = await trx
        .selectFrom('competition_slots')
        .selectAll()
        .where('competition_id', '=', competitionId)
        .where('stage', '=', next.stage)
        .where('position', '=', next.position)
        .executeTakeFirst();
      if (!nextSlot) {
        throw notFound('Place suivante');
      }
      const side = slot.position % 2 === 1 ? 'home_team_id' : 'away_team_id';
      if (nextSlot[side] && nextSlot[side] !== winner) {
        throw new AppError('INVALID_STATE', 'La place suivante est déjà occupée');
      }
      await trx
        .updateTable('competition_slots')
        .set(side === 'home_team_id' ? { home_team_id: winner } : { away_team_id: winner })
        .where('id', '=', nextSlot.id)
        .execute();
    });

    return this.bracket(competitionId);
  }
}

function toCompetition(row: CompetitionRow): Competition {
  return {
    id: row.id,
    name: row.name,
    format: row.format,
    status: row.status,
    starts_at: row.starts_at.toISOString(),
    ends_at: row.ends_at ? row.ends_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
  };
}

function toBracketSlot(row: {
  id: string;
  competition_id: string;
  stage: BracketSlot['stage'];
  position: number;
  match_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  winner_team_id: string | null;
}): BracketSlot {
  return {
    id: row.id,
    competition_id: row.competition_id,
    stage: row.stage,
    position: row.position,
    match_id: row.match_id,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    winner_team_id: row.winner_team_id,
  };
}
