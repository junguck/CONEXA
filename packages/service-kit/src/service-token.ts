import { timingSafeEqual } from 'node:crypto';

import { Injectable, type CanActivate, type ExecutionContext, type Type } from '@nestjs/common';
import { AppError } from '@conexa/errors';
import type { Request } from 'express';

/**
 * Routes `/internal/*` : jamais exposées par la Gateway (qui bloque le préfixe),
 * appelées directement de service à service avec `x-service-token`.
 *
 * Absent côté service, il n'y a pas de repli silencieux : la route répond une
 * erreur explicite plutôt qu'une donnée inventée.
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
  return left.length === right.length && timingSafeEqual(left, right);
}

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

/** Garde paramétrée par le jeton attendu, construit au démarrage du service. */
export function createServiceTokenGuard(expected: string | undefined): Type<CanActivate> {
  @Injectable()
  class ServiceTokenGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<Request>();
      const header = request.headers['x-service-token'];
      assertServiceToken(Array.isArray(header) ? header[0] : header, expected);
      return true;
    }
  }
  return ServiceTokenGuard;
}
