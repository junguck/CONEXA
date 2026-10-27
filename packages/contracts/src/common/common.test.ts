import { describe, expect, it } from 'vitest';

import { ERROR_STATUS, ApiErrorSchema, ErrorCodeSchema, errorStatus } from './error.js';
import { JwtClaimsSchema, RoleSchema } from './identity.js';
import { commission, MoneySchema, sumMoney } from './money.js';
import { decodeCursor, encodeCursor, PageQuerySchema, pageSchema } from './pagination.js';

describe('montants FCFA', () => {
  it('refuse les décimales', () => {
    expect(MoneySchema.safeParse(8000.5).success).toBe(false);
  });

  it('refuse les montants négatifs', () => {
    expect(MoneySchema.safeParse(-1).success).toBe(false);
  });

  it('additionne en entiers et calcule une commission au franc inférieur', () => {
    expect(sumMoney([4000, 4500])).toBe(8500);
    expect(commission(8500, 10)).toBe(850);
    expect(commission(8555, 10)).toBe(855);
  });
});

describe('pagination par curseur', () => {
  it('applique la limite par défaut et refuse au-delà du plafond', () => {
    expect(PageQuerySchema.parse({}).limit).toBe(20);
    expect(PageQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('fait un aller-retour de curseur opaque', () => {
    const cursor = encodeCursor('2026-10-26T10:00:00Z|uuid');
    expect(decodeCursor(cursor)).toBe('2026-10-26T10:00:00Z|uuid');
    expect(cursor).not.toContain('|');
  });

  it('valide une page', () => {
    const schema = pageSchema(MoneySchema);
    expect(schema.parse({ data: [8000], next_cursor: null }).data).toEqual([8000]);
  });
});

describe('codes d’erreur', () => {
  it('couvre les statuts attendus', () => {
    expect(errorStatus('RATE_LIMITED')).toBe(429);
    expect(errorStatus('CONTACT_NOT_REVEALED')).toBe(403);
    expect(errorStatus('INTERNAL_ERROR')).toBe(500);
    expect(Object.keys(ERROR_STATUS)).toContain('WEEKLY_QUOTA_EXCEEDED');
  });

  it('valide l’enveloppe d’erreur', () => {
    const parsed = ApiErrorSchema.parse({
      error: { code: 'CANCEL_WINDOW_CLOSED', message: 'Trop tard', request_id: 'req_1' },
    });
    expect(parsed.error.code).toBe('CANCEL_WINDOW_CLOSED');
    expect(ErrorCodeSchema.safeParse('NOT_A_CODE').success).toBe(false);
  });
});

describe('identité', () => {
  it('valide les rôles et les jetons', () => {
    expect(RoleSchema.safeParse('admin').success).toBe(true);
    expect(RoleSchema.safeParse('root').success).toBe(false);
    expect(
      JwtClaimsSchema.parse({
        sub: '6f1c2a3e-0f2b-4c55-9f4f-1f3a2b4c5d6e',
        roles: ['student'],
        status: 'active',
      }).roles,
    ).toEqual(['student']);
  });
});
