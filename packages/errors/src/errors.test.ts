import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, isErrorCode } from './codes.js';
import { ERROR_HTTP_STATUS, httpStatusFor } from './http.js';
import { AppError, isAppError, toErrorEnvelope } from './app-error.js';

const apiDoc = fileURLToPath(new URL('../../../docs/product/API.md', import.meta.url));

/** Extrait `| \`CODE\` | 401 | sens |` du contrat d'API livré. */
function codesFromApiDoc(): Map<string, number> {
  const text = readFileSync(apiDoc, 'utf8');
  const found = new Map<string, number>();
  for (const line of text.split('\n')) {
    const match = /^\|\s*`([A-Z][A-Z_]+)`\s*\|\s*(\d{3})\s*\|/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      found.set(match[1], Number(match[2]));
    }
  }
  return found;
}

describe('catalogue des codes d’erreur', () => {
  it('reprend tous les codes de docs/product/API.md avec le même code HTTP', () => {
    const documented = codesFromApiDoc();
    expect(documented.size).toBeGreaterThan(40);
    for (const [code, status] of documented) {
      expect(isErrorCode(code), `${code} absent du paquet`).toBe(true);
      expect(ERROR_HTTP_STATUS[code as keyof typeof ERROR_HTTP_STATUS]).toBe(status);
    }
  });

  it('ne contient aucun doublon', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('expose le code HTTP de chaque code métier', () => {
    expect(httpStatusFor('NOT_FOUND')).toBe(404);
    expect(httpStatusFor('DUPLICATE_REQUEST')).toBe(409);
    expect(httpStatusFor('VALIDATION_ERROR')).toBe(422);
  });

  it('rejette une chaîne inconnue', () => {
    expect(isErrorCode('PAS_UN_CODE')).toBe(false);
  });
});

describe('AppError', () => {
  it('remplit l’enveloppe du contrat, détails et request_id compris', () => {
    const error = new AppError('INVALID_STATE', 'Transition interdite.', {
      details: { from: 'confirmed', to: 'negotiating' },
      requestId: 'req_8f2c',
    });
    expect(error.status).toBe(409);
    expect(error.toEnvelope()).toEqual({
      error: {
        code: 'INVALID_STATE',
        message: 'Transition interdite.',
        details: { from: 'confirmed', to: 'negotiating' },
        request_id: 'req_8f2c',
      },
    });
  });

  it('donne un message français par défaut, jamais vide', () => {
    const error = AppError.notFound();
    expect(error.message).toBe('Ressource introuvable.');
    expect(AppError.validation({ email: 'invalide' }).details).toEqual({ email: 'invalide' });
  });

  it('conserve la cause technique sans l’exposer', () => {
    const cause = new Error('connexion PostgreSQL perdue');
    const envelope = new AppError('INTERNAL_ERROR', undefined, { cause }).toEnvelope();
    expect(JSON.stringify(envelope)).not.toContain('PostgreSQL');
  });
});

describe('toErrorEnvelope', () => {
  it('laisse passer une AppError et complète request_id', () => {
    const envelope = toErrorEnvelope(AppError.forbidden('Rôle insuffisant.'), 'req_1');
    expect(envelope.error.code).toBe('FORBIDDEN');
    expect(envelope.error.request_id).toBe('req_1');
  });

  it('masque toute erreur inconnue derrière INTERNAL_ERROR', () => {
    const envelope = toErrorEnvelope(new Error('mot de passe = s3cret'), 'req_2');
    expect(envelope.error.code).toBe('INTERNAL_ERROR');
    expect(envelope.error.message).toBe('Erreur interne.');
    expect(envelope.error.request_id).toBe('req_2');
    expect(isAppError(new Error('x'))).toBe(false);
  });
});
