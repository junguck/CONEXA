import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/** Six chiffres, générés sans biais par randomInt (crypto). */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashCode(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

export function codeMatches(code: string, storedHash: string, secret: string): boolean {
  const candidate = Buffer.from(hashCode(code, secret), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function canAttempt(attempts: number): boolean {
  return attempts < OTP_MAX_ATTEMPTS;
}
