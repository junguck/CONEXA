import type { PaymentStatus } from '@conexa/contracts';
import { invalidState } from '@conexa/errors';

/**
 * Table des transitions autorisées : fermée, testée exhaustivement. Un paiement
 * ne repasse jamais de `released` ou `refunded` à un autre état.
 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['escrow', 'failed'],
  escrow: ['released', 'refund_pending'],
  refund_pending: ['refunded'],
  released: [],
  refunded: [],
  failed: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransition(from, to)) {
    throw invalidState(`Transition de paiement refusée : ${from} → ${to}`);
  }
}

/** Un paiement ne se libère que s'il est encore sous séquestre. */
export function isHeldInEscrow(status: PaymentStatus): boolean {
  return status === 'escrow';
}
