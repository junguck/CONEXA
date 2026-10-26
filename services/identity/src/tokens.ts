import { createHash, randomBytes } from 'node:crypto';

import type { JwtClaims } from '@conexa/contracts';
import { SignJWT, calculateJwkThumbprint, exportJWK, importPKCS8, importSPKI } from 'jose';

export interface RefreshRecord {
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

export type RefreshVerdict = 'valid' | 'rotated' | 'revoked' | 'expired';

/**
 * Un jeton déjà tourné mais présenté à nouveau est une réutilisation :
 * toute la famille doit être révoquée (ARCHITECTURE.md §11).
 */
export function assessRefresh(record: RefreshRecord, now: Date = new Date()): RefreshVerdict {
  if (record.revokedAt !== null) {
    return 'revoked';
  }
  if (record.rotatedAt !== null) {
    return 'rotated';
  }
  if (record.expiresAt.getTime() <= now.getTime()) {
    return 'expired';
  }
  return 'valid';
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface AccessTokenInput {
  claims: JwtClaims;
  privateKeyPem: string;
  issuer: string;
  ttlSeconds: number;
}

export async function signAccessToken(input: AccessTokenInput): Promise<string> {
  const key = await importPKCS8(input.privateKeyPem, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: input.claims.sub,
    roles: input.claims.roles,
    status: input.claims.status,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(input.issuer)
    .setIssuedAt(now)
    .setExpirationTime(now + input.ttlSeconds)
    .sign(key);
}

/** Clé publique → JWKS consommé par le gateway. */
export async function publicKeyToJwks(publicKeyPem: string): Promise<{ keys: unknown[] }> {
  const key = await importSPKI(publicKeyPem, 'RS256');
  const jwk = await exportJWK(key);
  const kid = await calculateJwkThumbprint(jwk, 'sha256');
  return { keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] };
}
