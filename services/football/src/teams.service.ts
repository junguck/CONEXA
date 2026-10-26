import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateTeamInput,
  Team,
  TeamMember,
  TeamSearchQuery,
  UpdateTeamInput,
} from '@conexa/contracts';
import type { EventPublisher } from '@conexa/events';
import { createEvent } from '@conexa/events';
import { AppError, forbidden, notFound } from '@conexa/errors';
import { sql } from 'kysely';

import { db } from './db.js';
import { cooldownUntil, assertCanJoin, assertSquadHasRoom } from './rules.js';
import {
  FOOTBALL_CLOCK,
  FOOTBALL_EVENTS,
  decodePageCursor,
  encodePageCursor,
  isUniqueViolation,
  toTeam,
  type TeamRow,
} from './shared.js';

@Injectable()
export class TeamsService {
  constructor(
    @Inject(FOOTBALL_CLOCK) private readonly now: () => Date,
    @Inject(FOOTBALL_EVENTS) private readonly bus: EventPublisher,
  ) {}

  async create(userId: string, input: CreateTeamInput): Promise<Team> {
    await this.assertNoActiveTeam(userId);

    const team = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('teams')
        .values({
          name: input.name,
          filiere_id: input.filiere_id,
          logo_upload_id: input.logo_upload_id ?? null,
          captain_id: userId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('team_members')
        .values({ team_id: created.id, user_id: userId, role: 'captain' })
        .execute();
      return created;
    });

    await this.bus.publish(
      createEvent({
        type: 'team.created',
        producer: 'football',
        payload: { team_id: team.id, captain_id: userId, filiere_id: team.filiere_id },
      }),
    );

    return toTeam(team, 1);
  }

  async list(query: TeamSearchQuery): Promise<{ data: Team[]; next_cursor: string | null }> {
    let select = db.selectFrom('teams').selectAll().where('status', '=', 'active');

    if (query.q) {
      select = select.where('name', 'ilike', `%${query.q}%`);
    }
    if (query.filiere_id) {
      select = select.where('filiere_id', '=', query.filiere_id);
    }
    if (query.level) {
      select = select.where('level', '=', query.level);
    }
    if (query.recruiting !== undefined) {
      select = select.where('recruiting', '=', query.recruiting);
    }
    if (query.cursor) {
      select = select.where('created_at', '<', new Date(decodePageCursor(query.cursor)));
    }

    const rows = await select
      .orderBy('created_at', 'desc')
      .limit(query.limit + 1)
      .execute();

    const page = rows.slice(0, query.limit);
    const counts = await this.memberCounts(page.map((row) => row.id));
    const last = page.at(-1);

    return {
      data: page.map((row) => toTeam(row, counts.get(row.id) ?? 0)),
      next_cursor:
        rows.length > query.limit && last ? encodePageCursor(last.created_at.toISOString()) : null,
    };
  }

  async get(teamId: string): Promise<Team> {
    const row = await this.findTeam(teamId);
    const counts = await this.memberCounts([row.id]);
    return toTeam(row, counts.get(row.id) ?? 0);
  }

  async myTeam(userId: string): Promise<{ team: Team; my_role: 'captain' | 'player' } | null> {
    const membership = await this.activeMembership(userId);
    if (!membership) {
      return null;
    }
    const row = await this.findTeam(membership.team_id);
    const counts = await this.memberCounts([row.id]);
    return { team: toTeam(row, counts.get(row.id) ?? 0), my_role: membership.role };
  }

  async members(teamId: string): Promise<TeamMember[]> {
    await this.findTeam(teamId);
    const rows = await db
      .selectFrom('team_members')
      .selectAll()
      .where('team_id', '=', teamId)
      .where('left_at', 'is', null)
      .orderBy('role', 'asc')
      .orderBy('joined_at', 'asc')
      .execute();

    return rows.map((row) => ({
      user_id: row.user_id,
      role: row.role,
      position: row.position,
      goals: row.goals,
      assists: row.assists,
      matches: row.matches,
      joined_at: row.joined_at.toISOString(),
    }));
  }

  async update(userId: string, teamId: string, input: UpdateTeamInput): Promise<Team> {
    await this.requireCaptain(teamId, userId);

    try {
      await db
        .updateTable('teams')
        .set({
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.logo_upload_id === undefined ? {} : { logo_upload_id: input.logo_upload_id }),
          ...(input.recruiting === undefined ? {} : { recruiting: input.recruiting }),
          updated_at: this.now(),
        })
        .where('id', '=', teamId)
        .execute();
    } catch (error) {
      if (isUniqueViolation(error, 'teams_name_filiere_uq')) {
        throw new AppError('INVALID_STATE', 'Ce nom d’équipe est déjà pris dans ta filière');
      }
      throw error;
    }

    return this.get(teamId);
  }

  async dissolve(userId: string, teamId: string): Promise<void> {
    await this.requireCaptain(teamId, userId);
    const now = this.now();

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('teams')
        .set({ status: 'dissolved', dissolved_at: now, updated_at: now, recruiting: false })
        .where('id', '=', teamId)
        .execute();
      await trx
        .updateTable('team_members')
        .set({ left_at: now })
        .where('team_id', '=', teamId)
        .where('left_at', 'is', null)
        .execute();
    });

    await this.bus.publish(
      createEvent({ type: 'team.dissolved', producer: 'football', payload: { team_id: teamId } }),
    );
  }

  /** Départ : gel de 7 jours, refusé au capitaine tant qu'il n'a pas transféré. */
  async leave(userId: string, teamId: string): Promise<void> {
    const membership = await this.activeMembership(userId);
    if (!membership || membership.team_id !== teamId) {
      throw forbidden('Tu ne fais pas partie de cette équipe');
    }
    if (membership.role === 'captain') {
      throw new AppError('INVALID_STATE', 'Transfère le capitanat avant de quitter l’équipe');
    }

    const now = this.now();
    await db
      .updateTable('team_members')
      .set({ left_at: now, cooldown_until: cooldownUntil(now) })
      .where('team_id', '=', teamId)
      .where('user_id', '=', userId)
      .execute();
  }

  async transferCaptain(userId: string, teamId: string, targetUserId: string): Promise<void> {
    await this.requireCaptain(teamId, userId);
    if (targetUserId === userId) {
      throw new AppError('VALIDATION_ERROR', 'Tu es déjà capitaine');
    }

    await db.transaction().execute(async (trx) => {
      const target = await trx
        .selectFrom('team_members')
        .select('user_id')
        .where('team_id', '=', teamId)
        .where('user_id', '=', targetUserId)
        .where('left_at', 'is', null)
        .executeTakeFirst();
      if (!target) {
        throw notFound('Membre');
      }
      await trx
        .updateTable('team_members')
        .set({ role: 'captain' })
        .where('team_id', '=', teamId)
        .where('user_id', '=', targetUserId)
        .execute();
      await trx
        .updateTable('team_members')
        .set({ role: 'player' })
        .where('team_id', '=', teamId)
        .where('user_id', '=', userId)
        .execute();
      await trx
        .updateTable('teams')
        .set({ captain_id: targetUserId, updated_at: this.now() })
        .where('id', '=', teamId)
        .execute();
    });
  }

  async removeMember(userId: string, teamId: string, memberId: string): Promise<void> {
    await this.requireCaptain(teamId, userId);
    if (memberId === userId) {
      throw new AppError('INVALID_STATE', 'Utilise le transfert de capitanat');
    }
    const now = this.now();
    const result = await db
      .updateTable('team_members')
      .set({ left_at: now, cooldown_until: cooldownUntil(now) })
      .where('team_id', '=', teamId)
      .where('user_id', '=', memberId)
      .where('left_at', 'is', null)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) {
      throw notFound('Membre');
    }
  }

  async setPosition(
    userId: string,
    teamId: string,
    memberId: string,
    position: TeamMember['position'],
  ): Promise<void> {
    await this.requireCaptain(teamId, userId);
    const result = await db
      .updateTable('team_members')
      .set({ position })
      .where('team_id', '=', teamId)
      .where('user_id', '=', memberId)
      .where('left_at', 'is', null)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) {
      throw notFound('Membre');
    }
  }

  // --- invitations et demandes ------------------------------------------

  async inviteMember(captainId: string, teamId: string, targetUserId: string): Promise<void> {
    const team = await this.requireCaptain(teamId, captainId);
    if (team.status !== 'active') {
      throw new AppError('TEAM_NOT_ACTIVE', 'Cette équipe n’est plus active');
    }
    if (targetUserId === captainId) {
      throw new AppError('VALIDATION_ERROR', 'Tu fais déjà partie de l’équipe');
    }

    const [membership, counts] = await Promise.all([
      this.activeMembership(targetUserId),
      this.memberCounts([teamId]),
    ]);
    if (membership) {
      throw new AppError('TEAM_ALREADY_MEMBER', 'Ce joueur a déjà une équipe');
    }
    assertSquadHasRoom(counts.get(teamId) ?? 0);

    try {
      await db
        .insertInto('team_invites')
        .values({
          team_id: teamId,
          user_id: targetUserId,
          direction: 'invite',
          created_by: captainId,
        })
        .execute();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('INVALID_STATE', 'Une invitation est déjà en attente');
      }
      throw error;
    }
  }

  async requestJoin(userId: string, teamId: string): Promise<void> {
    const team = await this.findTeam(teamId);
    if (team.status !== 'active') {
      throw new AppError('TEAM_NOT_ACTIVE', 'Cette équipe n’est plus active');
    }
    await this.assertNoActiveTeam(userId);

    const counts = await this.memberCounts([teamId]);
    assertSquadHasRoom(counts.get(teamId) ?? 0);

    try {
      await db
        .insertInto('team_invites')
        .values({ team_id: teamId, user_id: userId, direction: 'request', created_by: userId })
        .execute();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('INVALID_STATE', 'Une demande est déjà en attente');
      }
      throw error;
    }
  }

  async pendingRequests(
    captainId: string,
    teamId: string,
  ): Promise<Array<{ id: string; user_id: string; created_at: string }>> {
    await this.requireCaptain(teamId, captainId);
    const rows = await db
      .selectFrom('team_invites')
      .select(['id', 'user_id', 'created_at'])
      .where('team_id', '=', teamId)
      .where('direction', '=', 'request')
      .where('status', '=', 'pending')
      .where('expires_at', '>', this.now())
      .orderBy('created_at', 'asc')
      .execute();
    return rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      created_at: row.created_at.toISOString(),
    }));
  }

  async myInvites(userId: string) {
    const rows = await db
      .selectFrom('team_invites')
      .innerJoin('teams', 'teams.id', 'team_invites.team_id')
      .select(['team_invites.id', 'team_invites.team_id', 'team_invites.created_at', 'teams.name'])
      .where('team_invites.user_id', '=', userId)
      .where('team_invites.direction', '=', 'invite')
      .where('team_invites.status', '=', 'pending')
      .where('team_invites.expires_at', '>', this.now())
      .orderBy('team_invites.created_at', 'desc')
      .execute();
    return rows.map((row) => ({
      id: row.id,
      team_id: row.team_id,
      team_name: row.name,
      created_at: row.created_at.toISOString(),
    }));
  }

  /** Accepte une invitation (destinataire) ou une demande (capitaine). */
  async resolveInvite(userId: string, inviteId: string, accept: boolean): Promise<void> {
    const invite = await db
      .selectFrom('team_invites')
      .selectAll()
      .where('id', '=', inviteId)
      .executeTakeFirst();
    if (!invite) {
      throw notFound('Invitation');
    }
    if (invite.status !== 'pending') {
      throw new AppError('INVALID_STATE', 'Invitation déjà traitée');
    }

    const team = await this.findTeam(invite.team_id);
    if (team.status !== 'active') {
      throw new AppError('TEAM_NOT_ACTIVE', 'Cette équipe n’est plus active');
    }

    const isTarget = invite.user_id === userId;
    const isCaptain = team.captain_id === userId;
    const actorAllowed = invite.direction === 'invite' ? isTarget : isCaptain;
    if (!actorAllowed) {
      throw forbidden('Tu ne peux pas répondre à cette invitation');
    }

    const now = this.now();

    if (!accept) {
      await db
        .updateTable('team_invites')
        .set({ status: 'declined', resolved_at: now })
        .where('id', '=', inviteId)
        .execute();
      return;
    }

    await this.assertNoActiveTeam(invite.user_id);
    const counts = await this.memberCounts([invite.team_id]);
    assertSquadHasRoom(counts.get(invite.team_id) ?? 0);

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('team_members')
        .values({ team_id: invite.team_id, user_id: invite.user_id, role: 'player' })
        .onConflict((oc) =>
          oc.columns(['team_id', 'user_id']).doUpdateSet({
            role: 'player',
            left_at: null,
            cooldown_until: null,
            joined_at: now,
          }),
        )
        .execute();
      await trx
        .updateTable('team_invites')
        .set({ status: 'accepted', resolved_at: now })
        .where('id', '=', inviteId)
        .execute();
    });
  }

  // --- helpers internes -------------------------------------------------

  async findTeam(teamId: string): Promise<TeamRow> {
    const row = await db
      .selectFrom('teams')
      .selectAll()
      .where('id', '=', teamId)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Équipe');
    }
    return row;
  }

  async activeMembership(
    userId: string,
  ): Promise<{ team_id: string; role: 'captain' | 'player' } | undefined> {
    return db
      .selectFrom('team_members')
      .select(['team_id', 'role'])
      .where('user_id', '=', userId)
      .where('left_at', 'is', null)
      .executeTakeFirst();
  }

  async requireCaptain(teamId: string, userId: string): Promise<TeamRow> {
    const team = await this.findTeam(teamId);
    if (team.captain_id !== userId) {
      throw new AppError('NOT_CAPTAIN', 'Seul le capitaine peut faire cela');
    }
    return team;
  }

  async assertNoActiveTeam(userId: string): Promise<void> {
    const [membership, last] = await Promise.all([
      this.activeMembership(userId),
      db
        .selectFrom('team_members')
        .select('cooldown_until')
        .where('user_id', '=', userId)
        .where('left_at', 'is not', null)
        .orderBy('left_at', 'desc')
        .executeTakeFirst(),
    ]);

    assertCanJoin({
      activeTeamId: membership?.team_id ?? null,
      cooldownUntil: last?.cooldown_until ?? null,
      now: this.now(),
    });
  }

  async memberCounts(teamIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (teamIds.length === 0) {
      return counts;
    }
    const rows = await db
      .selectFrom('team_members')
      .select(['team_id', sql<string>`count(*)`.as('count')])
      .where('team_id', 'in', teamIds)
      .where('left_at', 'is', null)
      .groupBy('team_id')
      .execute();
    for (const row of rows) {
      counts.set(row.team_id, Number(row.count));
    }
    return counts;
  }
}
