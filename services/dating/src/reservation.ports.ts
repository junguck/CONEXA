/**
 * Ports de la saga de réservation. Dating n'accède jamais à la base d'un autre
 * service : Partners et Payments sont appelés par leurs routes internes.
 */

export type HoldOutcome =
  { status: 'held'; expires_at: string } | { status: 'rejected'; reason: string };

export interface PartnersPort {
  hold(slotId: string, holdRef: string): Promise<HoldOutcome>;
  /** `confirmed` si la retenue est devenue définitive ; tout autre statut = table perdue. */
  confirm(holdRef: string): Promise<{ status: string }>;
  release(holdRef: string): Promise<{ status: string }>;
}

export interface PaymentsPort {
  /** Idempotent côté Payments : une double demande ne produit qu'un décaissement. */
  refund(paymentId: string): Promise<void>;
}

export const PARTNERS_PORT = Symbol('PARTNERS_PORT');
export const PAYMENTS_PORT = Symbol('PAYMENTS_PORT');
