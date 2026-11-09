import type {
  CreatePaymentInput,
  Invoice,
  Payment,
  Plan,
  SubscribeInput,
  Subscription,
} from '@conexa/contracts';

import { apiClient, type ApiClient } from '../../shell/api/client';
import type { BillingOverview } from '../../shell/api/endpoints';

/**
 * Appels de l'argent côté étudiant. Chemins du Gateway (manifestes
 * `services/billing` et `services/payments`). Rien n'est calculé ici : montants,
 * statuts et droits viennent des réponses.
 */
export function createMoneyApi(client: ApiClient) {
  return {
    plans: () => client.get<Plan[]>('billing/plans'),
    overview: () => client.get<BillingOverview>('billing/me'),
    invoices: () => client.get<Invoice[]>('billing/invoices'),
    subscribe: (input: SubscribeInput, idempotencyKey: string) =>
      client.post<Subscription>('billing/subscriptions', input, { idempotencyKey }),
    activate: (subscriptionId: string, paymentId: string) =>
      client.post<Subscription>(
        `billing/subscriptions/${encodeURIComponent(subscriptionId)}/activate`,
        {
          payment_id: paymentId,
        },
      ),
    cancel: (subscriptionId: string) =>
      client.post<Subscription>(
        `billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
        {
          at_period_end: true,
        },
      ),
    pay: (input: Omit<CreatePaymentInput, 'idempotency_key'>, idempotencyKey: string) =>
      client.post<Payment>(
        'payments',
        { ...input, idempotency_key: idempotencyKey },
        { idempotencyKey },
      ),
    payment: (paymentId: string) =>
      client.get<Payment>(`payments/${encodeURIComponent(paymentId)}`),
    myPayments: () => client.page<Payment>('me/payments', { query: { limit: 50 } }),
  };
}

export const moneyApi = createMoneyApi(apiClient);
