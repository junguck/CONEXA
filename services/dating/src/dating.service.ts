import { randomInt } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type {
  DatingInvite,
  DatingPick,
  DatingProfile,
  Eligibility,
  PutDatingProfileInput,
} from '@conexa/contracts';
import { QUESTIONNAIRE_BLOCKS } from '@conexa/contracts';
import { AppError, notFound, validationError } from '@conexa/errors';
import { sql } from 'kysely';

import { db } from './db.js';
import {
  AGE_LIMITS_MESSAGE,
  DATING_CLOCK,
  assertKeysMatchQuestionnaire,
  toProfile,
} from './profile.js';
import {
  ageAt,
  assertAdult,
  assertInviteQuota,
  eligibilityOf,
  invitesLeft,
  resolvePayer,
  weekStart,
} from './rules.js';

@Injectable()
export class DatingService {
  constructor(@Inject(DATING_CLOCK) private readonly now: () => Date) {}

  // --- éligibilité et profil ---------------------------------------------

  async eligibility(userId: string): Promise<Eligibility> {
    const row = await this.findProfile(userId);
    if (!row) {
      return { eligible: false, reasons: ['QUESTIONNAIRE_MISSING'] };
    }
    return eligibilityOf({
      birthDate: row.birth_date,
      questionnaireVersion: row.questionnaire_v,
      reliability: row.reliability,
      now: this.now(),
    });
  }

  async profile(userId: string): Promise<DatingProfile> {
    const row = await this.requireProfile(userId);
    return toProfile(row);
  }

  async putProfile(userId: string, input: PutDatingProfileInput): Promise<DatingProfile> {
    const now = this.now();
    const birthDate = new Date(`${input.birth_date}T00:00:00.000Z`);
    assertAdult(birthDate, now);
    assertKeysMatchQuestionnaire(input.answers, QUESTIONNAIRE_BLOCKS);

    const existing = await this.findProfile(userId);
    if (existing && input.questionnaire_v < existing.questionnaire_v) {
      throw validationError('Version de questionnaire obsolète');
    }
    if (input.age_min > input.age_max) {
      throw validationError(AGE_LIMITS_MESSAGE);
    }

    await db
      .insertInto('dating_profiles')
      .values({
        user_id: userId,
        birth_date: birthDate,
        questionnaire_v: input.questionnaire_v,
        answers: input.answers,
        seeking: input.seeking,
        age_min: input.age_min,
        age_max: input.age_max,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.column('user_id').doUpdateSet({
          birth_date: birthDate,
          questionnaire_v: input.questionnaire_v,
          answers: input.answers,
          seeking: input.seeking,
          age_min: input.age_min,
          age_max: input.age_max,
          status: 'active',
          updated_at: now,
        }),
      )
      .execute();

    return this.profile(userId);
  }

  async patchPreferences(
    userId: string,
    input: { seeking?: string[]; age_min?: number; age_max?: number },
  ): Promise<void> {
    const row = await this.requireProfile(userId);
    const ageMin = input.age_min ?? row.age_min;
    const ageMax = input.age_max ?? row.age_max;
    if (ageMin > ageMax) {
      throw validationError(AGE_LIMITS_MESSAGE);
    }

    await db
      .updateTable('dating_profiles')
      .set({
        ...(input.seeking === undefined ? {} : { seeking: input.seeking }),
        age_min: ageMin,
        age_max: ageMax,
        updated_at: this.now(),
      })
      .where('user_id', '=', userId)
      .execute();
  }

  async setPaused(userId: string, paused: boolean): Promise<void> {
    await this.requireProfile(userId);
    await db
      .updateTable('dating_profiles')
      .set({ status: paused ? 'paused' : 'active', updated_at: this.now() })
      .where('user_id', '=', userId)
      .execute();
  }

  async credits(userId: string) {
    const rows = await db
      .selectFrom('date_credits')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map((row) => ({
      id: row.id,
      amount_fcfa: row.amount_fcfa,
      reason: row.reason,
      expires_at: row.expires_at?.toISOString() ?? null,
      used: row.used_at !== null,
    }));
  }

  // --- internes ----------------------------------------------------------

  async findProfile(userId: string) {
    return db
      .selectFrom('dating_profiles')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();
  }

  async requireProfile(userId: string) {
    const row = await this.findProfile(userId);
    if (!row) {
      throw notFound('Profil de rencontres');
    }
    return row;
  }

  async requireEligible(userId: string) {
    const eligibility = await this.eligibility(userId);
    if (!eligibility.eligible) {
      const reason = eligibility.reasons[0];
      if (reason === 'AGE_RESTRICTED') {
        throw new AppError('AGE_RESTRICTED', 'Le module est réservé aux majeurs');
      }
      throw new AppError('RELIABILITY_TOO_LOW', 'Conditions d’accès non remplies', {
        reasons: eligibility.reasons,
      });
    }
    return this.requireProfile(userId);
  }

  // --- propositions de la semaine ----------------------------------------

  async currentPicks(userId: string): Promise<{
    week_start: string;
    quota_left: number;
    picks: DatingPick[];
  }> {
    await this.requireEligible(userId);
    const week = weekStart(this.now());

    let rows = await db
      .selectFrom('weekly_picks')
      .selectAll()
      .where('user_id', '=', userId)
      .where('week_start', '=', week)
      .orderBy('created_at', 'asc')
      .execute();

    if (rows.length === 0) {
      rows = await this.generatePicks(userId, week);
    }

    return {
      week_start: week,
      quota_left: invitesLeft(await this.countSentThisWeek(userId, week)),
      picks: rows.map(toPick),
    };
  }

  async inviteFromPick(userId: string, pickId: string): Promise<DatingInvite> {
    const now = this.now();
    const week = weekStart(now);
    const pick = await db
      .selectFrom('weekly_picks')
      .selectAll()
      .where('id', '=', pickId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!pick) {
      throw notFound('Proposition');
    }
    if (pick.week_start !== week || pick.decision !== 'none') {
      throw new AppError('PICK_EXPIRED', 'Cette proposition n’est plus disponible');
    }

    assertInviteQuota(await this.countSentThisWeek(userId, week));

    const invite = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('invites')
        .values({
          from_user_id: userId,
          to_user_id: pick.candidate_id,
          pick_id: pick.id,
          week_start: week,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .updateTable('weekly_picks')
        .set({ decision: 'invited' })
        .where('id', '=', pick.id)
        .execute();
      return created;
    });

    return toInvite(invite);
  }

  async passPick(userId: string, pickId: string): Promise<void> {
    const result = await db
      .updateTable('weekly_picks')
      .set({ decision: 'passed' })
      .where('id', '=', pickId)
      .where('user_id', '=', userId)
      .where('decision', '=', 'none')
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) {
      throw notFound('Proposition');
    }
  }

  async listInvites(userId: string, box: 'received' | 'sent'): Promise<DatingInvite[]> {
    const rows = await db
      .selectFrom('invites')
      .selectAll()
      .where(box === 'received' ? 'to_user_id' : 'from_user_id', '=', userId)
      .where('status', '=', 'pending')
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map(toInvite);
  }

  /** Accepter une invitation crée le date et fige le payeur (règle : l’invitant paie). */
  async acceptInvite(userId: string, inviteId: string): Promise<{ date_id: string }> {
    const invite = await db
      .selectFrom('invites')
      .selectAll()
      .where('id', '=', inviteId)
      .where('to_user_id', '=', userId)
      .executeTakeFirst();
    if (!invite) {
      throw notFound('Invitation');
    }
    if (invite.status !== 'pending') {
      throw new AppError('INVALID_STATE', 'Invitation déjà traitée');
    }

    const payerId = resolvePayer(invite);
    const now = this.now();

    const date = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('dates')
        .values({
          invite_id: invite.id,
          user_a: invite.from_user_id,
          user_b: invite.to_user_id,
          payer_id: payerId,
          checkin_code: String(randomInt(100_000, 999_999)),
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();
      await trx
        .updateTable('invites')
        .set({ status: 'accepted', resolved_at: now })
        .where('id', '=', invite.id)
        .execute();
      return created;
    });

    return { date_id: date.id };
  }

  async declineInvite(userId: string, inviteId: string): Promise<void> {
    const result = await db
      .updateTable('invites')
      .set({ status: 'declined', resolved_at: this.now() })
      .where('id', '=', inviteId)
      .where('to_user_id', '=', userId)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) {
      throw notFound('Invitation');
    }
  }

  async withdrawInvite(userId: string, inviteId: string): Promise<void> {
    const result = await db
      .updateTable('invites')
      .set({ status: 'withdrawn', resolved_at: this.now() })
      .where('id', '=', inviteId)
      .where('from_user_id', '=', userId)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) {
      throw notFound('Invitation');
    }
  }

  // --- internes ----------------------------------------------------------

  private async countSentThisWeek(userId: string, week: string): Promise<number> {
    const row = await db
      .selectFrom('invites')
      .select(sql<string>`count(*)`.as('count'))
      .where('from_user_id', '=', userId)
      .where('week_start', '=', week)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  /**
   * Sans pgvector en v1 (T-0014), les propositions sont tirées parmi les profils
   * éligibles : deux « similaires » puis une « complémentaire ». Le worker IA
   * remplacera ce tirage par le classement d’embeddings.
   */
  private async generatePicks(userId: string, week: string) {
    const me = await this.requireProfile(userId);
    const now = this.now();
    const previous = await db
      .selectFrom('weekly_picks')
      .select('candidate_id')
      .where('user_id', '=', userId)
      .execute();
    const excluded = new Set(previous.map((row) => row.candidate_id));
    excluded.add(userId);

    const candidates = await db
      .selectFrom('dating_profiles')
      .selectAll()
      .where('status', '=', 'active')
      .limit(100)
      .execute();

    const chosen = candidates
      .filter((candidate) => {
        if (excluded.has(candidate.user_id)) {
          return false;
        }
        const gender = candidate.gender;
        if (
          !gender ||
          !me.seeking.includes(gender) ||
          !candidate.seeking.includes(me.gender ?? '')
        ) {
          return false;
        }
        const age = ageAt(candidate.birth_date, now);
        if (age < me.age_min || age > me.age_max) {
          return false;
        }
        return eligibilityOf({
          birthDate: candidate.birth_date,
          questionnaireVersion: candidate.questionnaire_v,
          reliability: candidate.reliability,
          now,
        }).eligible;
      })
      .slice(0, 3);

    if (chosen.length === 0) {
      return [];
    }

    const values = chosen.map((candidate, index) => ({
      user_id: userId,
      candidate_id: candidate.user_id,
      week_start: week,
      kind: index === 2 ? ('complementary' as const) : ('similar' as const),
      compat_label: index === 2 ? 'Profil complémentaire' : 'Très compatible',
    }));

    await db
      .insertInto('weekly_picks')
      .values(values)
      .onConflict((oc) => oc.doNothing())
      .execute();

    return db
      .selectFrom('weekly_picks')
      .selectAll()
      .where('user_id', '=', userId)
      .where('week_start', '=', week)
      .execute();
  }
}

function toPick(row: {
  id: string;
  candidate_id: string;
  kind: 'similar' | 'complementary';
  compat_label: string;
  decision: 'none' | 'invited' | 'passed';
  week_start: string;
}): DatingPick {
  return {
    id: row.id,
    candidate_id: row.candidate_id,
    kind: row.kind,
    compat_label: row.compat_label,
    decision: row.decision,
    week_start: row.week_start,
  };
}

function toInvite(row: {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
  week_start: string;
  created_at: Date;
}): DatingInvite {
  return {
    id: row.id,
    from_user_id: row.from_user_id,
    to_user_id: row.to_user_id,
    status: row.status,
    week_start: row.week_start,
    created_at: row.created_at.toISOString(),
  };
}
