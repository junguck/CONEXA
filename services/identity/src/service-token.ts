import { timingSafeEqual } from 'node:crypto';

import { AppError } from '@conexa/errors';

/**
 * Vérifie le jeton partagé entre services (`x-service-token`).
 *
 * Les routes `/internal/*` ne sont jamais exposées par la Gateway ; ce jeton est
 * la seule barrière. Absent côté Identity, il n'y a pas de repli silencieux :
 * la route répond une erreur explicite plutôt qu'une valeur inventée.
 */
export function serviceTokenMatches(
  provided: string | undefined,
  expected: string | undefined,
): boolean {
  if (!provided || !expected) {
    return false;
  }
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/** Lève l'erreur à renvoyer quand la route interne est mal configurée ou mal appelée. */
export function assertServiceToken(
  provided: string | undefined,
  expected: string | undefined,
): void {
  if (!expected) {
    throw new AppError(
      'FORBIDDEN',
      'Passerelle interne non configurée : SERVICE_TOKEN est absent de ce service',
    );
  }
  if (!serviceTokenMatches(provided, expected)) {
    throw new AppError('FORBIDDEN', 'Jeton de service invalide');
  }
}
