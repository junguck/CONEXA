import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PENDING_TTL_MS,
  POLL_FAST_INTERVAL_MS,
  POLL_SLOW_INTERVAL_MS,
  decidePoll,
  expiresAt,
  nextCheckAt,
  pollInterval,
} from './payments.schedule.js';

const createdAt = new Date('2026-10-27T10:00:00.000Z');
const at = (minutes: number, seconds = 0): Date =>
  new Date(createdAt.getTime() + minutes * 60_000 + seconds * 1_000);

describe('cadence de la relève', () => {
  it('interroge toutes les 30 s pendant 15 min', () => {
    expect(pollInterval(0)).toBe(POLL_FAST_INTERVAL_MS);
    expect(pollInterval(14 * 60_000 + 59_000)).toBe(POLL_FAST_INTERVAL_MS);
    expect(nextCheckAt(createdAt, at(1))).toEqual(new Date(at(1).getTime() + 30_000));
  });

  it('ralentit à 5 min à partir de la quinzième minute', () => {
    expect(pollInterval(15 * 60_000)).toBe(POLL_SLOW_INTERVAL_MS);
    expect(pollInterval(16 * 60_000)).toBe(POLL_SLOW_INTERVAL_MS);
    expect(nextCheckAt(createdAt, at(16))).toEqual(new Date(at(16).getTime() + 300_000));
  });

  it('fixe une échéance par défaut de 30 min', () => {
    expect(expiresAt(createdAt)).toEqual(new Date(createdAt.getTime() + DEFAULT_PENDING_TTL_MS));
  });
});

describe('décision de relève', () => {
  const expires = expiresAt(createdAt);

  it('encaisse un succès confirmé par l’API', () => {
    expect(decidePoll({ status: 'successful', now: at(2), expiresAt: expires })).toEqual({
      action: 'settle',
    });
  });

  it('marque un échec fournisseur', () => {
    expect(decidePoll({ status: 'failed', now: at(2), expiresAt: expires })).toEqual({
      action: 'fail',
      reason: 'provider_failure',
    });
  });

  it('replanifie tant que le statut est pending', () => {
    expect(decidePoll({ status: 'pending', now: at(2), expiresAt: expires })).toEqual({
      action: 'reschedule',
    });
  });

  it('abandonne proprement après l’échéance', () => {
    expect(decidePoll({ status: 'pending', now: at(31), expiresAt: expires })).toEqual({
      action: 'abandon',
      reason: 'expired',
    });
    expect(decidePoll({ status: 'unknown', now: at(31), expiresAt: expires })).toEqual({
      action: 'abandon',
      reason: 'expired',
    });
  });

  it('ne change rien sur un statut illisible avant l’échéance', () => {
    expect(decidePoll({ status: 'unknown', now: at(3), expiresAt: expires })).toEqual({
      action: 'reschedule',
    });
  });

  it('un succès l’emporte sur une échéance dépassée : l’argent est arrivé', () => {
    expect(decidePoll({ status: 'successful', now: at(45), expiresAt: expires })).toEqual({
      action: 'settle',
    });
  });
});
