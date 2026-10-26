import type { MatchEvent, Team, TeamLevel } from '@conexa/contracts';
import { MatchEventSchema } from '@conexa/contracts';
import { AppError } from '@conexa/errors';
import type { Selectable } from 'kysely';

import type { TeamsTable } from './db.js';

export const FOOTBALL_CLOCK = Symbol('FOOTBALL_CLOCK');
export const FOOTBALL_EVENTS = Symbol('FOOTBALL_EVENTS');

export type TeamRow = Selectable<TeamsTable>;

export function toTeam(row: TeamRow, memberCount: number): Team {
  return {
    id: row.id,
    name: row.name,
    filiere_id: row.filiere_id,
    logo_upload_id: row.logo_upload_id,
    level: row.level as TeamLevel,
    elo: row.elo,
    recruiting: row.recruiting,
    member_count: memberCount,
    created_at: row.created_at.toISOString(),
  };
}

export function encodePageCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodePageCursor(cursor: string): string {
  try {
    return Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Curseur de pagination invalide');
  }
}

/** Un créneau déjà réservé est signalé par la contrainte unique (23505). */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  if (code !== '23505') {
    return false;
  }
  if (!constraint) {
    return true;
  }
  return String((error as { constraint?: unknown }).constraint ?? '').includes(constraint);
}

export function parseEvents(value: unknown): MatchEvent[] {
  return MatchEventSchema.array().parse(value ?? []);
}

export function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}
