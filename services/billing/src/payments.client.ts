import type { PaymentStatus } from '@conexa/contracts';
import { AppError } from '@conexa/errors';

import { env } from './config.js';

export interface PaymentSnapshot {
  id: string;
  object_type: string;
  object_id: string;
  amount_fcfa: number;
  status: PaymentStatus;
}

export interface SubscriptionPayments {
  getPayment(paymentId: string): Promise<PaymentSnapshot>;
}

/** Appel direct à Payments (`/internal/*`, jamais via la Gateway). */
export class HttpSubscriptionPayments implements SubscriptionPayments {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  async getPayment(paymentId: string): Promise<PaymentSnapshot> {
    const response = await fetch(`${this.baseUrl}/internal/payments/${paymentId}`, {
      headers: { 'x-service-token': this.token },
    });
    if (response.status === 404) {
      throw new AppError('NOT_FOUND', 'Paiement introuvable');
    }
    if (!response.ok) {
      throw new AppError('INTERNAL_ERROR', 'Payments n’a pas pu fournir le paiement');
    }
    return (await response.json()) as PaymentSnapshot;
  }
}

/**
 * Sans `PAYMENTS_URL`, Billing refuse d'activer un plan payant plutôt que de
 * croire un identifiant arbitraire : un faux succès en production serait pire
 * qu'une erreur explicite.
 */
export function createSubscriptionPayments(): SubscriptionPayments {
  if (!env.PAYMENTS_URL || !env.SERVICE_TOKEN) {
    return {
      async getPayment(): Promise<PaymentSnapshot> {
        throw new AppError(
          'INTERNAL_ERROR',
          'PAYMENTS_URL et SERVICE_TOKEN requis pour activer un abonnement payant',
        );
      },
    };
  }
  return new HttpSubscriptionPayments(env.PAYMENTS_URL, env.SERVICE_TOKEN);
}
