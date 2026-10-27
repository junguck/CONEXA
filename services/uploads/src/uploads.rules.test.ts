import { describe, expect, it } from 'vitest';
import { AppError } from '@conexa/errors';
import { DAILY_UPLOAD_QUOTA, UPLOAD_RULES } from '@conexa/contracts';

import {
  assertAttachable,
  assertContentTypeMatches,
  assertOwner,
  assertSlotAvailable,
  assertWithinLimit,
  quotaAllows,
  readHeaders,
  validateDeclaration,
} from './uploads.rules.js';

const MB = 1024 * 1024;

describe('déclaration d’un envoi', () => {
  it('accepte une photo de profil JPEG sous la limite', () => {
    expect(() =>
      validateDeclaration({ purpose: 'profile_photo', contentType: 'image/jpeg', byteSize: MB }),
    ).not.toThrow();
  });

  it('refuse un type non prévu pour l’usage, en listant les types autorisés', () => {
    try {
      validateDeclaration({
        purpose: 'profile_photo',
        contentType: 'application/pdf',
        byteSize: 1000,
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('UPLOAD_TYPE_NOT_ALLOWED');
      expect((error as AppError).status).toBe(415);
      expect((error as AppError).details?.allowed).toEqual([
        'image/jpeg',
        'image/png',
        'image/webp',
      ]);
    }
  });

  it('refuse un fichier trop lourd avant tout stockage', () => {
    try {
      validateDeclaration({
        purpose: 'team_logo',
        contentType: 'image/png',
        byteSize: UPLOAD_RULES.team_logo.maxBytes + 1,
      });
      expect.unreachable();
    } catch (error) {
      expect((error as AppError).code).toBe('UPLOAD_TOO_LARGE');
      expect((error as AppError).status).toBe(413);
      expect((error as AppError).details?.max_bytes).toBe(UPLOAD_RULES.team_logo.maxBytes);
    }
  });

  it('garde la même table de limites pour tous les usages', () => {
    expect(UPLOAD_RULES.profile_photo.maxPerObject).toBe(1);
    expect(UPLOAD_RULES.listing_photo.maxPerObject).toBe(6);
    expect(UPLOAD_RULES.portfolio.contentTypes).toContain('application/pdf');
    expect(UPLOAD_RULES.event_banner.contentTypes).not.toContain('application/pdf');
  });
});

describe('écriture du contenu', () => {
  it('exige le même type MIME que la déclaration', () => {
    expect(() => assertContentTypeMatches('image/png', 'image/png')).not.toThrow();
    expect(() => assertContentTypeMatches('image/png', 'image/png; charset=binary')).not.toThrow();
    expect(() => assertContentTypeMatches('image/png', 'image/jpeg')).toThrow(AppError);
    expect(() => assertContentTypeMatches('image/png', undefined)).toThrow(
      /Type MIME reçu différent/,
    );
  });

  it('mesure la taille réelle et refuse un fichier vide', () => {
    expect(() => assertWithinLimit('portfolio', 10 * MB)).not.toThrow();
    expect(() => assertWithinLimit('portfolio', 10 * MB + 1)).toThrow(/trop lourd/);
    expect(() => assertWithinLimit('portfolio', 0)).toThrow(/vide/);
  });

  it('applique un quota quotidien par compte', () => {
    expect(quotaAllows(0)).toBe(true);
    expect(quotaAllows(DAILY_UPLOAD_QUOTA - 1)).toBe(true);
    expect(quotaAllows(DAILY_UPLOAD_QUOTA)).toBe(false);
  });
});

describe('propriété et pièces jointes', () => {
  it('réserve l’écriture au propriétaire', () => {
    expect(() => assertOwner('a', 'a')).not.toThrow();
    expect(() => assertOwner('a', 'b')).toThrow(/autre compte/);
  });

  it('n’attache qu’un fichier déjà reçu', () => {
    expect(() => assertAttachable('ready')).not.toThrow();
    expect(() => assertAttachable('pending')).toThrow(/contenu requis/);
    expect(() => assertAttachable('deleted')).toThrow(/supprimé/);
  });

  it('limite le nombre de fichiers par objet', () => {
    expect(() => assertSlotAvailable('listing_photo', 5)).not.toThrow();
    expect(() => assertSlotAvailable('listing_photo', 6)).toThrow(/Limite de 6/);
    expect(() => assertSlotAvailable('profile_photo', 1)).toThrow(/Limite de 1/);
  });

  it('sert les fichiers avec un cache immuable et sans reniflage', () => {
    expect(readHeaders('image/png')).toEqual({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
  });
});
