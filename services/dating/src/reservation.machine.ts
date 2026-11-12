/**
 * Machine d'états de la saga de réservation d'un date (ARCHITECTURE.md §6.1).
 * Fonction pure : (état, événement) → (nouvel état, actions à exécuter). Aucune
 * I/O. Les actions sont persistées par le service puis exécutées de façon
 * idempotente ; rejouer un événement ne change rien.
 *
 *   holding ─hold_ok→ awaiting_payment ─payment_escrowed→ confirming ─hold_confirmed→ confirmed
 *      │                    │                                  │
 *   hold_rejected      payment_failed / hold_expired       confirm_failed
 *      ▼                    ▼                                  ▼
 *   failed(SLOT_LOST)   failed(PAYMENT_FAILED|HOLD_EXPIRED)  failed(HOLD_EXPIRED) + remboursement
 */

export type SagaState =
  'holding' | 'awaiting_payment' | 'confirming' | 'confirmed' | 'failed' | 'cancelled';

export type FailureReason = 'SLOT_LOST' | 'PAYMENT_FAILED' | 'HOLD_EXPIRED';

export interface SagaSnapshot {
  state: SagaState;
  reason: FailureReason | null;
  /** Paiement qui a mis les fonds en séquestre pour cette réservation. */
  payment_id: string | null;
}

export type SagaEvent =
  | { type: 'started' }
  | { type: 'hold_ok' }
  | { type: 'hold_rejected' }
  | { type: 'hold_expired' }
  | { type: 'payment_escrowed'; payment_id: string }
  | { type: 'payment_failed' }
  | { type: 'hold_confirmed' }
  | { type: 'confirm_failed' }
  | { type: 'cancel_requested' };

export type SagaAction =
  | { kind: 'request_hold' }
  | { kind: 'confirm_hold' }
  | { kind: 'release_hold' }
  | { kind: 'confirm_date' }
  | { kind: 'refund_payment'; payment_id: string };

export interface Transition {
  next: SagaSnapshot;
  actions: SagaAction[];
  /** Faux si l'événement est un rejeu ou n'a pas d'effet dans cet état. */
  changed: boolean;
}

export const INITIAL: SagaSnapshot = { state: 'holding', reason: null, payment_id: null };

const same = (snapshot: SagaSnapshot): Transition => ({
  next: snapshot,
  actions: [],
  changed: false,
});

export function transition(current: SagaSnapshot | null, event: SagaEvent): Transition {
  if (current === null) {
    return event.type === 'started'
      ? { next: INITIAL, actions: [{ kind: 'request_hold' }], changed: true }
      : { next: INITIAL, actions: [], changed: false };
  }

  // Argent arrivé hors du chemin nominal : toujours rendu, jamais gardé en silence.
  if (event.type === 'payment_escrowed') {
    if (current.state === 'awaiting_payment') {
      return {
        next: { state: 'confirming', reason: null, payment_id: event.payment_id },
        actions: [{ kind: 'confirm_hold' }],
        changed: true,
      };
    }
    // Même paiement déjà pris en compte : rejeu sans effet.
    if (current.payment_id === event.payment_id && current.state !== 'failed') return same(current);
    if (current.state === 'failed' && current.payment_id === event.payment_id) return same(current);
    return {
      next: current.state === 'failed' ? { ...current, payment_id: event.payment_id } : current,
      actions: [{ kind: 'refund_payment', payment_id: event.payment_id }],
      changed: true,
    };
  }

  switch (current.state) {
    case 'holding':
      if (event.type === 'hold_ok') {
        return { next: { ...current, state: 'awaiting_payment' }, actions: [], changed: true };
      }
      if (event.type === 'hold_rejected') {
        return {
          next: { ...current, state: 'failed', reason: 'SLOT_LOST' },
          actions: [],
          changed: true,
        };
      }
      if (event.type === 'hold_expired') {
        return {
          next: { ...current, state: 'failed', reason: 'HOLD_EXPIRED' },
          actions: [],
          changed: true,
        };
      }
      if (event.type === 'cancel_requested') {
        return {
          next: { ...current, state: 'cancelled' },
          actions: [{ kind: 'release_hold' }],
          changed: true,
        };
      }
      return same(current);

    case 'awaiting_payment':
      if (event.type === 'payment_failed') {
        return {
          next: { ...current, state: 'failed', reason: 'PAYMENT_FAILED' },
          actions: [{ kind: 'release_hold' }],
          changed: true,
        };
      }
      if (event.type === 'hold_expired') {
        return {
          next: { ...current, state: 'failed', reason: 'HOLD_EXPIRED' },
          actions: [],
          changed: true,
        };
      }
      if (event.type === 'cancel_requested') {
        return {
          next: { ...current, state: 'cancelled' },
          actions: [{ kind: 'release_hold' }],
          changed: true,
        };
      }
      return same(current);

    case 'confirming':
      if (event.type === 'hold_confirmed') {
        return {
          next: { ...current, state: 'confirmed' },
          actions: [{ kind: 'confirm_date' }],
          changed: true,
        };
      }
      if (event.type === 'confirm_failed' && current.payment_id) {
        // Fonds reçus mais table perdue : on rend l'argent.
        return {
          next: { ...current, state: 'failed', reason: 'HOLD_EXPIRED' },
          actions: [{ kind: 'refund_payment', payment_id: current.payment_id }],
          changed: true,
        };
      }
      return same(current);

    case 'confirmed':
      if (event.type === 'cancel_requested') {
        const actions: SagaAction[] = [{ kind: 'release_hold' }];
        if (current.payment_id)
          actions.push({ kind: 'refund_payment', payment_id: current.payment_id });
        return { next: { ...current, state: 'cancelled' }, actions, changed: true };
      }
      return same(current);

    case 'failed':
      // Nouvelle tentative : nouveau créneau ou nouveau paiement.
      if (event.type === 'started') {
        return {
          next: { state: 'holding', reason: null, payment_id: null },
          actions: [{ kind: 'request_hold' }],
          changed: true,
        };
      }
      return same(current);

    case 'cancelled':
      return same(current);
  }
}
