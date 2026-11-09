import { describe, expect, it } from 'vitest';

import {
  HOLD_MINUTES,
  canConfirm,
  canRelease,
  freeUnits,
  holdExpiry,
  holdVerdict,
  isLive,
  type HoldState,
} from './holds.rules.js';

const NOW = new Date('2026-11-09T10:00:00Z');
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const held = (minutes: number): HoldState => ({ status: 'held', expires_at: later(minutes) });

describe('retenue de créneau', () => {
  it('dure 15 minutes exactement', () => {
    expect(HOLD_MINUTES).toBe(15);
    expect(holdExpiry(NOW).toISOString()).toBe('2026-11-09T10:15:00.000Z');
  });

  it('une retenue échue ne compte plus, à la borne exacte comprise', () => {
    expect(isLive(held(1), NOW)).toBe(true);
    expect(isLive(held(0), NOW)).toBe(false);
    expect(isLive(held(-1), NOW)).toBe(false);
  });

  it('une retenue confirmée compte toujours, une libérée ou échue jamais', () => {
    expect(isLive({ status: 'confirmed', expires_at: later(-60) }, NOW)).toBe(true);
    expect(isLive({ status: 'released', expires_at: later(5) }, NOW)).toBe(false);
    expect(isLive({ status: 'expired', expires_at: later(5) }, NOW)).toBe(false);
  });

  it('compte les unités libres sans jamais passer sous zéro', () => {
    expect(freeUnits(2, [held(5)], NOW)).toBe(1);
    expect(freeUnits(1, [held(5), held(5)], NOW)).toBe(0);
  });

  it('dernière table : une retenue passe, la suivante est refusée SLOT_FULL', () => {
    const slot = { status: 'open' as const, starts_at: later(120), capacity: 1 };
    expect(holdVerdict(slot, [], NOW)).toEqual({ ok: true });
    expect(holdVerdict(slot, [held(10)], NOW)).toEqual({ ok: false, reason: 'SLOT_FULL' });
  });

  it('une retenue expirée libère la place', () => {
    const slot = { status: 'open' as const, starts_at: later(120), capacity: 1 };
    expect(holdVerdict(slot, [held(-1)], NOW)).toEqual({ ok: true });
  });

  it('refuse un créneau fermé ou déjà commencé', () => {
    expect(holdVerdict({ status: 'closed', starts_at: later(60), capacity: 5 }, [], NOW)).toEqual({
      ok: false,
      reason: 'SLOT_NOT_OPEN',
    });
    expect(holdVerdict({ status: 'open', starts_at: NOW, capacity: 5 }, [], NOW)).toEqual({
      ok: false,
      reason: 'SLOT_STARTED',
    });
  });

  it('confirmation : seulement depuis held non échue', () => {
    expect(canConfirm(held(5), NOW)).toBe(true);
    expect(canConfirm(held(0), NOW)).toBe(false);
    expect(canConfirm({ status: 'confirmed', expires_at: later(5) }, NOW)).toBe(false);
    expect(canConfirm({ status: 'released', expires_at: later(5) }, NOW)).toBe(false);
  });

  it('libération : seulement une retenue vivante', () => {
    expect(canRelease(held(-5))).toBe(true);
    expect(canRelease({ status: 'confirmed', expires_at: later(5) })).toBe(true);
    expect(canRelease({ status: 'released', expires_at: later(5) })).toBe(false);
    expect(canRelease({ status: 'expired', expires_at: later(5) })).toBe(false);
  });
});
