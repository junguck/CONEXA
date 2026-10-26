import { AppError } from '@conexa/errors';
import type { TokenVerifier } from '@conexa/service-kit';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { matchRoute, type ServiceManifest } from './manifest.js';
import { proxyRequest } from './proxy.js';
import { FixedWindowLimiter } from './rate-limit.js';

export interface GatewayOptions {
  manifests: ServiceManifest[];
  verifier: TokenVerifier;
  generalLimit?: FixedWindowLimiter;
  authLimit?: FixedWindowLimiter;
}

/** 120 req/min/utilisateur, 10 req/min sur /auth/* (API.md §1). */
export function createGatewayMiddleware(options: GatewayOptions): RequestHandler {
  const general = options.generalLimit ?? new FixedWindowLimiter(120, 60_000);
  const auth = options.authLimit ?? new FixedWindowLimiter(10, 60_000);

  return (request: Request, response: Response, next: NextFunction): void => {
    void (async () => {
      const pathname = request.path;
      const requestId = (request as Request & { id?: string }).id ?? 'req_unknown';

      if (pathname.startsWith('/internal')) {
        throw new AppError('FORBIDDEN', 'Chemin interne inaccessible');
      }

      const match = matchRoute(options.manifests, request.method, pathname);
      if (!match) {
        next();
        return;
      }

      let user;
      if (match.route.auth) {
        const header = request.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
          throw new AppError('UNAUTHENTICATED', 'Jeton absent');
        }
        user = await options.verifier.verify(header.slice('Bearer '.length));
      }

      const key = user?.sub ?? request.ip ?? 'anonymous';
      const limiter = pathname.startsWith('/auth/') ? auth : general;
      const decision = limiter.check(key);
      if (!decision.allowed) {
        response.setHeader('Retry-After', String(decision.retryAfterSeconds));
        throw new AppError('RATE_LIMITED', 'Trop de requêtes', {
          retry_after_seconds: decision.retryAfterSeconds,
        });
      }

      const extraHeaders: Record<string, string> = {
        'x-request-id': requestId,
        ...(user === undefined
          ? {}
          : {
              'x-user-id': user.sub,
              'x-user-roles': user.roles.join(','),
              'x-user-status': user.status,
            }),
      };

      proxyRequest(
        request,
        response,
        match.manifest.upstream,
        pathname + querySuffix(request),
        extraHeaders,
      );
    })().catch(next);
  };
}

function querySuffix(request: Request): string {
  const index = request.originalUrl.indexOf('?');
  return index === -1 ? '' : request.originalUrl.slice(index);
}
