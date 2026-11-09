/**
 * Règles pures de la retenue de créneau (F4.1). Aucune I/O : testées sans base.
 * Une retenue vaut 15 minutes ; elle consomme une unité de la capacité du créneau.
 */

export const HOLD_MINUTES = 15;

export type HoldStatus = 'held' | 'confirmed' | 'released' | 'expired';

export interface HoldState {
  status: HoldStatus;
  expires_at: Date;
}

export function holdExpiry(now: Date): Date {
  return new Date(now.getTime() + HOLD_MINUTES * 60_000);
}

/** Une retenue compte contre la capacité tant qu'elle est confirmée ou non échue. */
export function isLive(hold: HoldState, now: Date): boolean {
  if (hold.status === 'confirmed') return true;
  return hold.status === 'held' && hold.expires_at.getTime() > now.getTime();
}

export function freeUnits(capacity: number, holds: HoldState[], now: Date): number {
  return Math.max(0, capacity - holds.filter((hold) => isLive(hold, now)).length);
}

export type HoldRejection = 'SLOT_NOT_OPEN' | 'SLOT_STARTED' | 'SLOT_FULL';

export interface SlotInfo {
  status: 'open' | 'booked' | 'closed';
  starts_at: Date;
  capacity: number;
}

/** Une demande de retenue est acceptée ou refusée avec un motif stable. */
export function holdVerdict(
  slot: SlotInfo,
  holds: HoldState[],
  now: Date,
): { ok: true } | { ok: false; reason: HoldRejection } {
  if (slot.status === 'closed') return { ok: false, reason: 'SLOT_NOT_OPEN' };
  if (slot.starts_at.getTime() <= now.getTime()) return { ok: false, reason: 'SLOT_STARTED' };
  if (freeUnits(slot.capacity, holds, now) === 0) return { ok: false, reason: 'SLOT_FULL' };
  return { ok: true };
}

/** `confirmed` n'est accessible que depuis une retenue `held` non échue. */
export function canConfirm(hold: HoldState, now: Date): boolean {
  return hold.status === 'held' && hold.expires_at.getTime() > now.getTime();
}

/** Libérable tant qu'elle est vivante ; une retenue déjà libérée ou échue ne change plus. */
export function canRelease(hold: HoldState): boolean {
  return hold.status === 'held' || hold.status === 'confirmed';
}
