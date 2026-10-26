import { describe, expect, it } from 'vitest';
import {
  AdminDecisionSchema,
  MeSchema,
  OtpRequestSchema,
  PhoneSchema,
  RegisterSchema,
} from '@conexa/contracts';
import { AppError } from '@conexa/errors';
import { maskPhone } from '@conexa/service-kit';

import { assertCanUseApp } from './status.js';
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  canAttempt,
  codeMatches,
  generateOtpCode,
  hashCode,
  isExpired,
} from './otp.js';
import { assessRefresh, generateRefreshToken, hashToken } from './tokens.js';

const SECRET = 'secret-de-test';

describe('contrats identity', () => {
  it('accepte un numéro camerounais et refuse les autres', () => {
    expect(PhoneSchema.safeParse('+237655443312').success).toBe(true);
    expect(PhoneSchema.safeParse('0655443312').success).toBe(false);
    expect(PhoneSchema.safeParse('+33655443312').success).toBe(false);
    expect(OtpRequestSchema.safeParse({ whatsapp: '0655' }).success).toBe(false);
  });

  it('exige le consentement et un matricule valide', () => {
    const base = {
      full_name: 'Aïcha N.',
      matricule: 'ETU2026123',
      birth_date: '2004-05-10',
      gender: 'female',
      filiere_id: 1,
      study_level: 2,
    };
    expect(RegisterSchema.safeParse({ ...base, consent: true }).success).toBe(true);
    expect(RegisterSchema.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(RegisterSchema.safeParse({ ...base, consent: true, matricule: 'etu-123' }).success).toBe(
      false,
    );
  });

  it('valide la forme de Me', () => {
    const me = {
      id: '6f1c2a3e-0f2b-4c55-9f4f-1f3a2b4c5d6e',
      full_name: 'Aïcha N.',
      photo_url: null,
      filiere: { id: 1, name: 'Gestion' },
      study_level: 2,
      team: null,
      reliability_band: 'high',
      birth_date: null,
      gender: 'female',
      status: 'pending',
      role: 'student',
      reliability: 100,
      whatsapp_masked: '+237 6** *** **12',
      dating_enabled: false,
    };
    expect(MeSchema.safeParse(me).success).toBe(true);
    expect(MeSchema.safeParse({ ...me, status: 'inconnu' }).success).toBe(false);
    expect(AdminDecisionSchema.safeParse({}).success).toBe(true);
  });
});

describe('OTP', () => {
  it('génère six chiffres et un hachage stable mais sensible au secret', () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
    const hash = hashCode(code, SECRET);
    expect(hash).toBe(hashCode(code, SECRET));
    expect(codeMatches(code, hash, SECRET)).toBe(true);
    expect(codeMatches(code, hash, 'autre-secret')).toBe(false);
    expect(codeMatches('000000' === code ? '111111' : '000000', hash, SECRET)).toBe(false);
  });

  it('expire après cinq minutes et bloque au cinquième essai', () => {
    const expiresAt = new Date('2026-10-26T10:05:00Z');
    expect(isExpired(expiresAt, new Date(expiresAt.getTime() - OTP_TTL_MS))).toBe(false);
    expect(isExpired(expiresAt, new Date(expiresAt.getTime() - 1))).toBe(false);
    expect(isExpired(expiresAt, expiresAt)).toBe(true);
    expect(canAttempt(OTP_MAX_ATTEMPTS - 1)).toBe(true);
    expect(canAttempt(OTP_MAX_ATTEMPTS)).toBe(false);
  });
});

describe('jetons de rafraîchissement', () => {
  const future = new Date('2026-11-30T00:00:00Z');
  const now = new Date('2026-10-26T00:00:00Z');

  it('distingue valide, tourné, révoqué et expiré', () => {
    expect(assessRefresh({ expiresAt: future, rotatedAt: null, revokedAt: null }, now)).toBe(
      'valid',
    );
    expect(assessRefresh({ expiresAt: future, rotatedAt: now, revokedAt: null }, now)).toBe(
      'rotated',
    );
    expect(assessRefresh({ expiresAt: future, rotatedAt: null, revokedAt: now }, now)).toBe(
      'revoked',
    );
    expect(assessRefresh({ expiresAt: now, rotatedAt: null, revokedAt: null }, now)).toBe(
      'expired',
    );
  });

  it('produit des jetons aléatoires hachés', () => {
    const token = generateRefreshToken();
    expect(token.length).toBeGreaterThan(30);
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).not.toBe(token);
  });
});

describe('PII et états de compte', () => {
  it('masque le numéro WhatsApp', () => {
    expect(maskPhone('+237655443312')).toBe('+237 6** *** **12');
  });

  it('refuse les comptes non validés ou suspendus', () => {
    expect(() => assertCanUseApp('active')).not.toThrow();
    expect(() => assertCanUseApp('pending')).toThrow(AppError);
    expect(() => assertCanUseApp('banned')).toThrow(/suspendu/);
  });
});
