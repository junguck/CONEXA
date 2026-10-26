import {
  type CanActivate,
  createParamDecorator,
  type DynamicModule,
  type ExecutionContext,
  Inject,
  Injectable,
  Module,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtClaimsSchema, type JwtClaims, type Role } from '@conexa/contracts';
import { AppError } from '@conexa/errors';
import { createRemoteJWKSet, importSPKI, jwtVerify } from 'jose';
import type { Request } from 'express';

export const AUTH_VERIFIER = Symbol('CONEXA_AUTH_VERIFIER');
export const IS_PUBLIC = 'conexa:is-public';
export const REQUIRED_ROLES = 'conexa:roles';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ROLES, roles);

export interface AuthenticatedRequest extends Request {
  user: JwtClaims;
  requestId?: string;
}

export interface TokenVerifier {
  verify(token: string): Promise<JwtClaims>;
}

type VerifyKey = NonNullable<Parameters<typeof jwtVerify>[1]>;

/**
 * Vérificateur RS256 : clé publique locale (développement) ou JWKS d'Identity
 * avec cache et rotation (production, ARCHITECTURE.md §11).
 */
export function createJwtVerifier(options: {
  jwksUrl?: string;
  publicKey?: string;
  issuer?: string;
  audience?: string;
}): TokenVerifier {
  let key: VerifyKey | undefined;

  const resolveKey = async (): Promise<VerifyKey> => {
    if (key) {
      return key;
    }
    if (options.publicKey) {
      key = await importSPKI(options.publicKey, 'RS256');
    } else if (options.jwksUrl) {
      key = createRemoteJWKSet(new URL(options.jwksUrl));
    } else {
      throw new Error('Aucune clé de vérification JWT fournie (JWKS_URL ou JWT_PUBLIC_KEY)');
    }
    return key;
  };

  return {
    async verify(token: string): Promise<JwtClaims> {
      try {
        const { payload } = await jwtVerify(token, await resolveKey(), {
          algorithms: ['RS256'],
          ...(options.issuer === undefined ? {} : { issuer: options.issuer }),
          ...(options.audience === undefined ? {} : { audience: options.audience }),
        });
        const claims = JwtClaimsSchema.safeParse(payload);
        if (!claims.success) {
          throw new AppError('UNAUTHENTICATED', 'Jeton invalide');
        }
        return claims.data;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError('UNAUTHENTICATED', 'Jeton invalide ou expiré');
      }
    },
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_VERIFIER) private readonly verifier: TokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('UNAUTHENTICATED', 'Jeton absent');
    }

    request.user = await this.verifier.verify(header.slice('Bearer '.length));

    if (request.user.status === 'suspended' || request.user.status === 'banned') {
      throw new AppError('ACCOUNT_SUSPENDED', 'Compte suspendu ou banni');
    }

    const roles =
      this.reflector.getAllAndOverride<Role[]>(REQUIRED_ROLES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (roles.length > 0 && !roles.some((role) => request.user.roles.includes(role))) {
      throw new AppError('FORBIDDEN', 'Rôle insuffisant');
    }

    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtClaims =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);

@Module({})
export class AuthModule {
  static forRoot(verifier: TokenVerifier): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      providers: [{ provide: AUTH_VERIFIER, useValue: verifier }, JwtAuthGuard],
      exports: [AUTH_VERIFIER, JwtAuthGuard],
    };
  }
}
