import { describe, expect, it } from 'vitest';

import {
  buildPushMessage,
  nextFailureCount,
  partitionTargets,
  shouldPrune,
} from './notifications.rules.js';

const sent = { status: 'sent', errorCode: null } as const;

describe('charge utile', () => {
  it('impose une route interne et un tag stable', () => {
    const message = buildPushMessage({
      user_id: '0190d0f2-0000-7000-8000-000000000001',
      type: 'match.proposed',
      title: 'Nouveau défi',
      body: 'Les Lions vous défient samedi',
    });
    expect(message.url).toBe('/notifications');
    expect(message.tag).toBe('match.proposed');
  });

  it('garde la route fournie par le domaine', () => {
    const message = buildPushMessage({
      user_id: '0190d0f2-0000-7000-8000-000000000001',
      type: 'date.confirmed',
      title: 'Date confirmée',
      body: 'Vendredi 19 h',
      url: '/rencontres/dates/42',
    });
    expect(message.url).toBe('/rencontres/dates/42');
  });
});

describe('compteur d’échecs', () => {
  it('remet à zéro après un succès', () => {
    expect(nextFailureCount(3, sent)).toBe(0);
  });

  it('incrémente après un échec', () => {
    expect(nextFailureCount(3, { status: 'failed', errorCode: 'RATE_LIMITED' })).toBe(4);
  });
});

describe('suppression d’abonnement', () => {
  it('supprime tout de suite un endpoint mort', () => {
    expect(
      shouldPrune({ status: 'failed', errorCode: 'SUBSCRIPTION_GONE' }, 0, 5),
    ).toBe(true);
  });

  it('tolère un échec réseau isolé', () => {
    expect(shouldPrune({ status: 'failed', errorCode: 'PROVIDER_ERROR' }, 1, 5)).toBe(false);
  });

  it('oublie un abonnement qui échoue trop souvent', () => {
    expect(shouldPrune({ status: 'failed', errorCode: 'PROVIDER_ERROR' }, 5, 5)).toBe(true);
  });

  it('ne supprime jamais après un succès', () => {
    expect(shouldPrune(sent, 99, 5)).toBe(false);
  });
});

describe('doublons', () => {
  it('n’envoie qu’une fois par endpoint', () => {
    const { unique, duplicates } = partitionTargets([
      { endpoint: 'https://a/1' },
      { endpoint: 'https://a/1' },
      { endpoint: 'https://b/2' },
    ]);
    expect(unique).toHaveLength(2);
    expect(duplicates).toBe(1);
  });
});
