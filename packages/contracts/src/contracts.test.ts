import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AppError } from '@conexa/errors';
import {
  amountFcfaSchema,
  buildCommonOpenApiDocument,
  cursorQuerySchema,
  dateOnlySchema,
  errorEnvelopeSchema,
  pageSchema,
  toOpenApiSchema,
  uuidSchema,
} from './index.js';

const uuid = '0b27a4d2-3d13-4f01-8b3a-9a9f3f6a6f11';

describe('primitives', () => {
  it('accepte un UUID et rejette le reste', () => {
    expect(uuidSchema.safeParse(uuid).success).toBe(true);
    expect(uuidSchema.safeParse('42').success).toBe(false);
  });

  it('refuse un montant FCFA décimal ou négatif', () => {
    expect(amountFcfaSchema.safeParse(8000).success).toBe(true);
    expect(amountFcfaSchema.safeParse(80.5).success).toBe(false);
    expect(amountFcfaSchema.safeParse(-1).success).toBe(false);
  });

  it('valide une date civile et refuse un format local', () => {
    expect(dateOnlySchema.safeParse('2026-10-19').success).toBe(true);
    expect(dateOnlySchema.safeParse('19/10/2026').success).toBe(false);
  });
});

describe('pagination par curseur', () => {
  it('applique limit=20 par défaut et convertit la chaîne de requête', () => {
    expect(cursorQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(cursorQuerySchema.parse({ limit: '50', cursor: 'abc' })).toEqual({
      limit: 50,
      cursor: 'abc',
    });
  });

  it('borne limit à 100', () => {
    expect(cursorQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    expect(cursorQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('produit la forme { data, next_cursor }', () => {
    const page = pageSchema(uuidSchema);
    expect(page.parse({ data: [uuid], next_cursor: null })).toEqual({
      data: [uuid],
      next_cursor: null,
    });
    expect(page.safeParse({ data: [], next_cursor: 3 }).success).toBe(false);
  });
});

describe('enveloppe d’erreur', () => {
  it('accepte exactement la sortie de AppError', () => {
    const envelope = AppError.validation({ email: 'invalide' }, 'Champs invalides.').toEnvelope();
    expect(errorEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it('refuse un code absent du catalogue', () => {
    const invalid = { error: { code: 'PAS_UN_CODE', message: 'x' } };
    expect(errorEnvelopeSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('sérialisation OpenAPI', () => {
  it('retire $schema et conserve JSON Schema 2020-12', () => {
    const schema = toOpenApiSchema(amountFcfaSchema);
    expect(schema.$schema).toBeUndefined();
    expect(schema.type).toBe('integer');
  });

  it('garde le document committé synchronisé avec les schémas', () => {
    const committed = JSON.parse(
      readFileSync(new URL('../openapi/common.json', import.meta.url), 'utf8'),
    );
    expect(buildCommonOpenApiDocument()).toEqual(committed);
  });
});
