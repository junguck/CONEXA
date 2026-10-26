import { describe, expect, it } from 'vitest';
import { AppError, forbidden, invalidState, notFound, validationError } from '@conexa/errors';
import {
  ACCOUNT_STATUSES,
  ApiErrorSchema,
  CURRENCY,
  ERROR_STATUS,
  ErrorCodeSchema,
  IdSchema,
  IsoDateSchema,
  JwtClaimsSchema,
  MoneySchema,
  PAGE_DEFAULT_LIMIT,
  PAGE_MAX_LIMIT,
  PageQuerySchema,
  ROLES,
  RoleSchema,
  assertMoney,
  commission,
  decodeCursor,
  encodeCursor,
  errorStatus,
  sumMoney,
} from './index.js';
import type {
  AccountStatus,
  ApiError,
  ErrorCode,
  Id,
  IsoDate,
  JwtClaims,
  Money,
  Role,
} from './index.js';

/**
 * Test miroir (ADR 0007, T-0051) : il n'importe pas ce que le canonique
 * souhaite exporter, mais **exactement** ce que les services de la piste v1 et
 * `service-kit` importent. Un symbole retiré ou renommé casse ce fichier avant
 * qu'une seule branche v1 ne soit rebasée.
 */

const userId = '0b27a4d2-3d13-4f01-8b3a-9a9f3f6a6f11';

describe('surface v1 de @conexa/contracts', () => {
  it('garde ERROR_STATUS et errorStatus alignés sur le catalogue', () => {
    const code = 'NOT_FOUND' satisfies ErrorCode;
    expect(ERROR_STATUS[code]).toBe(404);
    expect(errorStatus(code)).toBe(404);
  });

  it('garde ErrorCodeSchema pour valider un code reçu', () => {
    expect(ErrorCodeSchema.safeParse('FORMULA_CAP_EXCEEDED').success).toBe(true);
    expect(ErrorCodeSchema.safeParse('PAS_UN_CODE').success).toBe(false);
  });

  it('valide un JWT v1 : rôles optionnels, statut actif par défaut', () => {
    const claims = JwtClaimsSchema.parse({ sub: userId });
    expect(claims.roles).toEqual([]);
    expect(claims.status).toBe('active');

    const captain: JwtClaims = JwtClaimsSchema.parse({
      sub: userId,
      roles: ['student', 'captain'],
      status: 'active',
      sid: 'sess_0123456789',
    });
    expect(captain.roles).toContain('captain');
  });

  it('expose les catalogues de rôles et de statuts v1', () => {
    const role: Role = RoleSchema.parse('restaurant_staff');
    const status: AccountStatus = 'suspended';
    expect(ROLES).toContain(role);
    expect(ACCOUNT_STATUSES).toContain(status);
    expect(RoleSchema.safeParse('root').success).toBe(false);
  });

  it('garde IdSchema et IsoDateSchema sur les primitives canoniques', () => {
    const id: Id = IdSchema.parse(userId);
    const date: IsoDate = IsoDateSchema.parse('2026-10-26T10:00:00.000Z');
    expect(id).toBe(userId);
    expect(date).toBe('2026-10-26T10:00:00.000Z');
    // Écart assumé (ADR 0007) : le canonique exige UTC, v1 acceptait un offset.
    expect(IsoDateSchema.safeParse('2026-10-26T10:00:00+01:00').success).toBe(false);
  });

  it('conserve les montants FCFA entiers et la commission v1', () => {
    const amount: Money = assertMoney(8_000);
    expect(CURRENCY).toBe('XAF');
    expect(sumMoney([amount, 2_000])).toBe(10_000);
    expect(commission(amount, 15)).toBe(1_200);
    expect(MoneySchema.safeParse(80.5).success).toBe(false);
    expect(() => commission(amount, 120)).toThrow(RangeError);
  });

  it('conserve PageQuerySchema et les bornes de pagination v1', () => {
    expect(PAGE_DEFAULT_LIMIT).toBe(20);
    expect(PAGE_MAX_LIMIT).toBe(100);
    expect(PageQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(PageQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('conserve les curseurs opaques v1', () => {
    const cursor = encodeCursor('deals:2026-10-26T10:00:00Z');
    expect(cursor).not.toContain(':');
    expect(decodeCursor(cursor)).toBe('deals:2026-10-26T10:00:00Z');
  });

  it('accepte l’enveloppe d’erreur v1 telle que la produit le Gateway', () => {
    const envelope: ApiError = {
      error: { code: 'INVALID_STATE', message: 'Transition interdite.', request_id: 'req_1' },
    };
    expect(ApiErrorSchema.safeParse(envelope).success).toBe(true);
  });
});

describe('surface v1 de @conexa/errors', () => {
  it('AppError accepte la forme à trois arguments (détails bruts)', () => {
    const error = new AppError('FORMULA_CAP_EXCEEDED', 'Ta sélection dépasse la formule', {
      cap: 3,
    });
    expect(error.details).toEqual({ cap: 3 });
    expect(error.status).toBe(422);
  });

  it('AppError distingue toujours les options de `details`', () => {
    const withOptions = new AppError('INVALID_STATE', 'Conflit', {
      details: { from: 'confirmed' },
      requestId: 'req_9',
    });
    expect(withOptions.details).toEqual({ from: 'confirmed' });
    expect(withOptions.requestId).toBe('req_9');
  });

  it('garde les helpers v1 et leurs messages par défaut', () => {
    expect(notFound('Date').message).toBe('Date introuvable');
    expect(notFound('Date').code).toBe('NOT_FOUND');
    expect(forbidden().message).toBe('Action interdite');
    expect(invalidState('Ce date ne peut plus être annulé').code).toBe('INVALID_STATE');
    expect(validationError('Champs invalides', { email: 'invalide' }).details).toEqual({
      email: 'invalide',
    });
  });
});
