import { describe, expect, it } from 'vitest';

import {
  INITIAL,
  transition,
  type SagaAction,
  type SagaEvent,
  type SagaSnapshot,
} from './reservation.machine.js';

const PAY = '11111111-1111-4111-8111-111111111111';

/** Rejoue une suite d'événements et renvoie l'état final et toutes les actions émises. */
function run(events: SagaEvent[], from: SagaSnapshot | null = null) {
  let snapshot = from;
  const actions: SagaAction[] = [];
  for (const event of events) {
    const result = transition(snapshot, event);
    snapshot = result.next;
    actions.push(...result.actions);
  }
  return { snapshot: snapshot!, actions };
}

describe('saga de réservation : chemin nominal', () => {
  it('retient, attend le paiement, confirme la table puis le date', () => {
    const { snapshot, actions } = run([
      { type: 'started' },
      { type: 'hold_ok' },
      { type: 'payment_escrowed', payment_id: PAY },
      { type: 'hold_confirmed' },
    ]);
    expect(snapshot).toEqual({ state: 'confirmed', reason: null, payment_id: PAY });
    expect(actions.map((action) => action.kind)).toEqual([
      'request_hold',
      'confirm_hold',
      'confirm_date',
    ]);
  });
});

describe('saga de réservation : échecs injectés', () => {
  it('créneau perdu (slot.rejected) : fin sans paiement ni remboursement', () => {
    const { snapshot, actions } = run([{ type: 'started' }, { type: 'hold_rejected' }]);
    expect(snapshot).toMatchObject({ state: 'failed', reason: 'SLOT_LOST' });
    expect(actions.map((action) => action.kind)).toEqual(['request_hold']);
  });

  it('paiement refusé : la table est libérée', () => {
    const { snapshot, actions } = run([
      { type: 'started' },
      { type: 'hold_ok' },
      { type: 'payment_failed' },
    ]);
    expect(snapshot).toMatchObject({ state: 'failed', reason: 'PAYMENT_FAILED' });
    expect(actions.map((action) => action.kind)).toEqual(['request_hold', 'release_hold']);
  });

  it('retenue expirée avant le paiement : échec HOLD_EXPIRED', () => {
    const { snapshot } = run([{ type: 'started' }, { type: 'hold_ok' }, { type: 'hold_expired' }]);
    expect(snapshot).toMatchObject({ state: 'failed', reason: 'HOLD_EXPIRED' });
  });

  it('argent arrivé après l’expiration : remboursé, jamais gardé', () => {
    const { snapshot, actions } = run([
      { type: 'started' },
      { type: 'hold_ok' },
      { type: 'hold_expired' },
      { type: 'payment_escrowed', payment_id: PAY },
    ]);
    expect(snapshot.state).toBe('failed');
    expect(actions).toContainEqual({ kind: 'refund_payment', payment_id: PAY });
  });

  it('table perdue à la confirmation : fonds reçus donc remboursement', () => {
    const { snapshot, actions } = run([
      { type: 'started' },
      { type: 'hold_ok' },
      { type: 'payment_escrowed', payment_id: PAY },
      { type: 'confirm_failed' },
    ]);
    expect(snapshot).toMatchObject({ state: 'failed', reason: 'HOLD_EXPIRED' });
    expect(actions).toContainEqual({ kind: 'refund_payment', payment_id: PAY });
  });

  it('second paiement sur une réservation confirmée : remboursé', () => {
    const other = '22222222-2222-4222-8222-222222222222';
    const confirmed = run([
      { type: 'started' },
      { type: 'hold_ok' },
      { type: 'payment_escrowed', payment_id: PAY },
      { type: 'hold_confirmed' },
    ]).snapshot;
    const result = transition(confirmed, { type: 'payment_escrowed', payment_id: other });
    expect(result.actions).toEqual([{ kind: 'refund_payment', payment_id: other }]);
    expect(result.next.state).toBe('confirmed');
  });
});

describe('annulation et nouvelle tentative', () => {
  it('annulation d’un date confirmé : table libérée et paiement remboursé', () => {
    const confirmed = run([
      { type: 'started' },
      { type: 'hold_ok' },
      { type: 'payment_escrowed', payment_id: PAY },
      { type: 'hold_confirmed' },
    ]).snapshot;
    const result = transition(confirmed, { type: 'cancel_requested' });
    expect(result.next.state).toBe('cancelled');
    expect(result.actions).toEqual([
      { kind: 'release_hold' },
      { kind: 'refund_payment', payment_id: PAY },
    ]);
  });

  it('annulation avant paiement : seule la table est libérée', () => {
    const result = transition(
      { state: 'awaiting_payment', reason: null, payment_id: null },
      { type: 'cancel_requested' },
    );
    expect(result.actions).toEqual([{ kind: 'release_hold' }]);
  });

  it('une réservation échouée peut être retentée', () => {
    const failed: SagaSnapshot = { state: 'failed', reason: 'PAYMENT_FAILED', payment_id: null };
    const result = transition(failed, { type: 'started' });
    expect(result.next).toEqual(INITIAL);
    expect(result.actions).toEqual([{ kind: 'request_hold' }]);
  });
});

describe('idempotence', () => {
  const events: SagaEvent[] = [
    { type: 'started' },
    { type: 'hold_ok' },
    { type: 'payment_escrowed', payment_id: PAY },
    { type: 'hold_confirmed' },
  ];

  it('rejouer un événement déjà appliqué ne change rien et n’émet aucune action', () => {
    let snapshot: SagaSnapshot | null = null;
    for (const event of events) {
      const first = transition(snapshot, event);
      const replay = transition(first.next, event);
      expect(replay.changed).toBe(false);
      expect(replay.actions).toEqual([]);
      snapshot = first.next;
    }
  });

  it('état terminal : plus aucun effet', () => {
    const cancelled: SagaSnapshot = { state: 'cancelled', reason: null, payment_id: PAY };
    for (const event of events) {
      expect(transition(cancelled, event).changed).toBe(false);
    }
  });

  it('un événement sans saga ne crée rien', () => {
    expect(transition(null, { type: 'hold_ok' }).changed).toBe(false);
  });
});
