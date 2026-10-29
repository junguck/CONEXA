import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { AccountStatus, JwtClaims } from '@conexa/contracts';
import { AppError, forbidden, notFound } from '@conexa/errors';
import { maskPhone } from '@conexa/service-kit';

import { createOtpSender, type OtpSender } from './otp-sender.js';

import { env } from './config.js';
import { db } from './db.js';
import {
  OTP_TTL_MS,
  canAttempt,
  codeMatches,
  generateOtpCode,
  hashCode,
  isExpired,
} from './otp.js';
import type { RegisterInput } from '@conexa/contracts';
import { assessRefresh, generateRefreshToken, hashToken, signAccessToken } from './tokens.js';
import type { TokenPair } from '@conexa/contracts';

@Injectable()
export class IdentityService {
  // Champs et non paramètres de constructeur : Nest les prendrait pour des
  // dépendances à injecter (il n'existe aucun provider `OtpSender`).
  private readonly sender: OtpSender = createOtpSender({
    provider: env.OTP_PROVIDER,
    url: env.MBOASMS_URL,
    apiKey: env.MBOASMS_API_KEY,
    sender: env.MBOASMS_SENDER,
  });
  private readonly now: () => Date = () => new Date();

  async requestOtp(whatsapp: string): Promise<void> {
    const code = generateOtpCode();
    const current = this.now();
    await db
      .insertInto('otp_codes')
      .values({
        whatsapp,
        code_hash: hashCode(code, env.OTP_HASH_SECRET),
        expires_at: new Date(current.getTime() + OTP_TTL_MS),
      })
      .execute();
    await this.sender.send(whatsapp, code);
  }

  async verifyOtp(whatsapp: string, code: string): Promise<TokenPair> {
    const otp = await db
      .selectFrom('otp_codes')
      .selectAll()
      .where('whatsapp', '=', whatsapp)
      .where('consumed_at', 'is', null)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();

    if (!otp || isExpired(otp.expires_at, this.now()) || !canAttempt(otp.attempts)) {
      throw new AppError('OTP_INVALID', 'Code invalide ou expiré');
    }

    if (!codeMatches(code, otp.code_hash, env.OTP_HASH_SECRET)) {
      await db
        .updateTable('otp_codes')
        .set({ attempts: otp.attempts + 1 })
        .where('id', '=', otp.id)
        .execute();
      throw new AppError('OTP_INVALID', 'Code invalide ou expiré');
    }

    await db
      .updateTable('otp_codes')
      .set({ consumed_at: this.now() })
      .where('id', '=', otp.id)
      .execute();

    const existing = await db
      .selectFrom('profiles')
      .select(['id', 'status', 'role'])
      .where('whatsapp', '=', whatsapp)
      .executeTakeFirst();

    if (existing?.status === 'deleted') {
      throw new AppError('ACCOUNT_SUSPENDED', 'Compte supprimé');
    }

    const profile =
      existing ??
      (await db
        .insertInto('profiles')
        .values({ whatsapp, status: 'pending', role: 'student' })
        .returning(['id', 'status', 'role'])
        .executeTakeFirstOrThrow());

    return this.issueTokens(
      profile.id,
      profile.status as AccountStatus,
      [profile.role],
      existing === undefined,
    );
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const record = await db
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', hashToken(refreshToken))
      .executeTakeFirst();

    if (!record) {
      throw new AppError('UNAUTHENTICATED', 'Jeton de rafraîchissement inconnu');
    }

    const verdict = assessRefresh(
      { expiresAt: record.expires_at, rotatedAt: record.rotated_at, revokedAt: record.revoked_at },
      this.now(),
    );

    if (verdict === 'rotated') {
      // Rejeu d'un jeton déjà tourné : on révoque toute la famille.
      await db
        .updateTable('refresh_tokens')
        .set({ revoked_at: this.now() })
        .where('family_id', '=', record.family_id)
        .where('revoked_at', 'is', null)
        .execute();
      throw new AppError('UNAUTHENTICATED', 'Jeton de rafraîchissement réutilisé');
    }

    if (verdict !== 'valid') {
      throw new AppError('UNAUTHENTICATED', 'Jeton de rafraîchissement expiré ou révoqué');
    }

    const profile = await db
      .selectFrom('profiles')
      .select(['id', 'status', 'role'])
      .where('id', '=', record.user_id)
      .executeTakeFirstOrThrow();

    if (profile.status === 'deleted') {
      throw new AppError('ACCOUNT_SUSPENDED', 'Compte supprimé');
    }

    await db
      .updateTable('refresh_tokens')
      .set({ rotated_at: this.now() })
      .where('id', '=', record.id)
      .execute();

    return this.issueTokens(
      profile.id,
      profile.status as AccountStatus,
      [profile.role],
      false,
      record.family_id,
    );
  }

  async logout(refreshToken: string): Promise<void> {
    await db
      .updateTable('refresh_tokens')
      .set({ revoked_at: this.now() })
      .where('token_hash', '=', hashToken(refreshToken))
      .execute();
  }

  async register(userId: string, input: RegisterInput): Promise<void> {
    const taken = await db
      .selectFrom('profiles')
      .select('id')
      .where('matricule', '=', input.matricule)
      .executeTakeFirst();

    if (taken && taken.id !== userId) {
      throw new AppError('MATRICULE_TAKEN', 'Matricule déjà utilisé');
    }

    await db
      .updateTable('profiles')
      .set({
        full_name: input.full_name,
        matricule: input.matricule,
        birth_date: input.birth_date,
        gender: input.gender,
        filiere_id: input.filiere_id,
        study_level: input.study_level,
        photo_upload_id: input.photo_upload_id ?? null,
        consent_at: this.now(),
        status: 'pending',
        updated_at: this.now(),
      })
      .where('id', '=', userId)
      .execute();
  }

  async me(userId: string) {
    const profile = await db
      .selectFrom('profiles')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!profile || profile.status === 'deleted') {
      throw notFound('Profil');
    }

    const filiere = profile.filiere_id
      ? await db
          .selectFrom('filieres')
          .select(['id', 'name'])
          .where('id', '=', profile.filiere_id)
          .executeTakeFirst()
      : undefined;

    return {
      id: profile.id,
      full_name: profile.full_name ?? 'Étudiant',
      photo_url: null,
      filiere: filiere ?? null,
      study_level: profile.study_level,
      team: null,
      reliability_band: band(profile.reliability),
      birth_date: toIsoDate(profile.birth_date),
      gender: profile.gender,
      status: profile.status,
      role: profile.role,
      reliability: profile.reliability,
      whatsapp_masked: maskPhone(profile.whatsapp),
      dating_enabled: profile.dating_enabled,
    };
  }

  async updateMe(
    userId: string,
    input: {
      full_name?: string;
      filiere_id?: number;
      study_level?: number;
      photo_upload_id?: string;
    },
  ): Promise<void> {
    await db
      .updateTable('profiles')
      .set({
        ...(input.full_name === undefined ? {} : { full_name: input.full_name }),
        ...(input.filiere_id === undefined ? {} : { filiere_id: input.filiere_id }),
        ...(input.study_level === undefined ? {} : { study_level: input.study_level }),
        ...(input.photo_upload_id === undefined ? {} : { photo_upload_id: input.photo_upload_id }),
        updated_at: this.now(),
      })
      .where('id', '=', userId)
      .execute();

    throwIfNoRow(
      await db.selectFrom('profiles').select('id').where('id', '=', userId).executeTakeFirst(),
    );
  }

  async pendingUsers() {
    return db
      .selectFrom('profiles')
      .select(['id', 'full_name', 'matricule', 'filiere_id', 'study_level', 'created_at'])
      .where('status', '=', 'pending')
      .orderBy('created_at', 'asc')
      .limit(100)
      .execute();
  }

  async decide(
    adminId: string,
    targetId: string,
    action: 'approve' | 'reject',
    reason?: string,
  ): Promise<void> {
    const profile = await db
      .selectFrom('profiles')
      .select(['id', 'status'])
      .where('id', '=', targetId)
      .executeTakeFirst();

    if (!profile) {
      throw notFound('Étudiant');
    }
    if (profile.status !== 'pending') {
      throw forbidden('Compte déjà traité');
    }

    const status: AccountStatus | 'deleted' = action === 'approve' ? 'active' : 'deleted';
    await db
      .updateTable('profiles')
      .set({ status, updated_at: this.now() })
      .where('id', '=', targetId)
      .execute();
    await db
      .insertInto('admin_actions')
      .values({ admin_id: adminId, target_id: targetId, action, reason: reason ?? null })
      .execute();
  }

  async publicUser(userId: string) {
    const profile = await db
      .selectFrom('profiles')
      .select(['id', 'full_name', 'filiere_id', 'study_level', 'reliability'])
      .where('id', '=', userId)
      .where('status', '=', 'active')
      .executeTakeFirst();

    if (!profile) {
      throw notFound('Étudiant');
    }

    const filiere = profile.filiere_id
      ? await db
          .selectFrom('filieres')
          .select(['id', 'name'])
          .where('id', '=', profile.filiere_id)
          .executeTakeFirst()
      : undefined;

    return {
      id: profile.id,
      full_name: profile.full_name ?? 'Étudiant',
      photo_url: null,
      filiere: filiere ?? null,
      study_level: profile.study_level,
      team: null,
      reliability_band: band(profile.reliability),
    };
  }

  /**
   * Contact brut, réservé aux services internes : Dating ne stocke jamais le
   * numéro et le demande seulement après un accord mutuel (F4.6).
   */
  async internalContact(userId: string) {
    const profile = await db
      .selectFrom('profiles')
      .select(['id', 'whatsapp', 'status'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!profile || profile.status === 'deleted') {
      throw notFound('Étudiant');
    }

    return { user_id: profile.id, whatsapp: profile.whatsapp, status: profile.status };
  }

  async report(
    reporterId: string,
    input: { target_type: string; target_id: string; reason: string; details?: string },
  ) {
    await db
      .insertInto('reports')
      .values({
        reporter_id: reporterId,
        target_type: input.target_type,
        target_id: input.target_id,
        reason: input.reason,
        details: input.details ?? null,
      })
      .execute();
  }

  async reliability(userId: string) {
    const profile = await db
      .selectFrom('profiles')
      .select(['reliability'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!profile) {
      throw notFound('Profil');
    }

    const events = await db
      .selectFrom('reliability_events')
      .select(['delta', 'reason', 'created_at'])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();

    return {
      score: profile.reliability,
      band: band(profile.reliability),
      events: events.map((event) => ({
        delta: event.delta,
        reason: event.reason,
        created_at: event.created_at,
      })),
    };
  }

  async filieres() {
    return db.selectFrom('filieres').select(['id', 'name']).orderBy('name').execute();
  }

  private async issueTokens(
    userId: string,
    status: AccountStatus,
    roles: JwtClaims['roles'],
    isNewUser: boolean,
    familyId: string = randomUUID(),
  ): Promise<TokenPair> {
    const accessToken = await signAccessToken({
      claims: { sub: userId, status, roles },
      privateKeyPem: env.JWT_PRIVATE_KEY,
      issuer: env.JWT_ISSUER,
      ttlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
    });

    const refreshToken = generateRefreshToken();
    await db
      .insertInto('refresh_tokens')
      .values({
        user_id: userId,
        token_hash: hashToken(refreshToken),
        family_id: familyId,
        expires_at: new Date(this.now().getTime() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      })
      .execute();

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: env.ACCESS_TOKEN_TTL_SECONDS,
      is_new_user: isNewUser,
    };
  }
}

/** `date` revient en Date depuis `pg` : le contrat expose une date ISO, pas un objet. */
function toIsoDate(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function band(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) {
    return 'high';
  }
  return score >= 40 ? 'medium' : 'low';
}

function throwIfNoRow(row: { id: string } | undefined): void {
  if (!row) {
    throw notFound('Profil');
  }
}

export { assertCanUseApp } from './status.js';
