import { AppError } from '@conexa/errors';

export const JOIN_COOLDOWN_DAYS = 7;
export const MIN_SQUAD_SIZE = 7;
export const MAX_SQUAD_SIZE = 16;
export const CANCEL_WINDOW_HOURS = 2;
export const CONTEST_WINDOW_HOURS = 48;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function cooldownUntil(leftAt: Date): Date {
  return new Date(leftAt.getTime() + JOIN_COOLDOWN_DAYS * DAY_MS);
}

/**
 * Un joueur n'a qu'une équipe active et ne peut pas rejoindre une équipe
 * dans les 7 jours qui suivent un départ (API.md §3.2).
 */
export function assertCanJoin(input: {
  activeTeamId?: string | null;
  cooldownUntil?: Date | null;
  now: Date;
}): void {
  if (input.activeTeamId) {
    throw new AppError('TEAM_ALREADY_MEMBER', 'Tu fais déjà partie d’une équipe');
  }
  if (input.cooldownUntil && input.cooldownUntil.getTime() > input.now.getTime()) {
    throw new AppError(
      'TEAM_JOIN_COOLDOWN',
      'Attends la fin du délai de 7 jours après ton dernier départ',
      { until: input.cooldownUntil.toISOString() },
    );
  }
}

export function assertSquadHasRoom(size: number): void {
  if (size >= MAX_SQUAD_SIZE) {
    throw new AppError('INVALID_STATE', `Effectif complet (${MAX_SQUAD_SIZE} joueurs)`);
  }
}

export function canCancelMatch(startsAt: Date, now: Date): boolean {
  return now.getTime() <= startsAt.getTime() - CANCEL_WINDOW_HOURS * HOUR_MS;
}

export function contestWindowOpen(finalizedAt: Date | null, now: Date): boolean {
  if (!finalizedAt) {
    return false;
  }
  return now.getTime() <= finalizedAt.getTime() + CONTEST_WINDOW_HOURS * HOUR_MS;
}
