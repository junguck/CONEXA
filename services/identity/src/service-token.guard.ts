import { CanActivate, Injectable, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { env } from './config.js';
import { assertServiceToken } from './service-token.js';

/**
 * Garde des routes `/internal/*` : réservée aux autres services, jamais au
 * navigateur ni à la Gateway (qui bloque `/internal`).
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['x-service-token'];
    assertServiceToken(Array.isArray(header) ? header[0] : header, env.SERVICE_TOKEN);
    return true;
  }
}
