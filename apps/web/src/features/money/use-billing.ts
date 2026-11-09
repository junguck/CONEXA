'use client';

import type { Payment, Subscription } from '@conexa/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { moneyApi } from './api';
import { purchasePhase, type PurchasePhase } from './view';

export const MONEY_KEYS = {
  plans: ['money', 'plans'] as const,
  overview: ['money', 'overview'] as const,
  invoices: ['money', 'invoices'] as const,
  payments: ['money', 'payments'] as const,
};

/** Cadence de relecture du statut pendant l'attente de confirmation. */
const POLL_MS = 3000;

export function usePlans() {
  return useQuery({ queryKey: MONEY_KEYS.plans, queryFn: moneyApi.plans });
}

export function useInvoices() {
  return useQuery({ queryKey: MONEY_KEYS.invoices, queryFn: moneyApi.invoices });
}

/**
 * Abonnement courant, paiement associé et phase d'achat. L'état d'attente est
 * relu depuis le serveur (abonnement `pending` + paiement), donc il survit à la
 * fermeture de l'application ; tant que la phase est `awaiting_confirmation`,
 * le statut du paiement est relu toutes les 3 secondes.
 */
export function usePurchase() {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: MONEY_KEYS.overview, queryFn: moneyApi.overview });
  const subscription: Subscription | null = overview.data?.subscription ?? null;
  const pendingId = subscription?.status === 'pending' ? subscription.id : null;

  const payments = useQuery({
    queryKey: [...MONEY_KEYS.payments, pendingId],
    enabled: pendingId !== null,
    queryFn: async () => (await moneyApi.myPayments()).data,
    refetchInterval: (query) => {
      const list = query.state.data as Payment[] | undefined;
      const latest = latestPaymentFor(list, pendingId);
      return latest?.status === 'pending' ? POLL_MS : false;
    },
  });

  const payment = latestPaymentFor(payments.data, pendingId);
  const attempts = (payments.data ?? []).filter(
    (item) => item.object_type === 'subscription' && item.object_id === pendingId,
  ).length;
  const phase: PurchasePhase = purchasePhase(subscription, payment?.status ?? null);

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: MONEY_KEYS.overview }),
      queryClient.invalidateQueries({ queryKey: MONEY_KEYS.invoices }),
      queryClient.invalidateQueries({ queryKey: MONEY_KEYS.payments }),
    ]);
  }, [queryClient]);

  return {
    overview,
    subscription,
    payment,
    phase,
    attempts,
    refresh,
    isLoading: overview.isLoading,
  };
}

function latestPaymentFor(list: Payment[] | undefined, subscriptionId: string | null) {
  if (!list || !subscriptionId) return undefined;
  return list
    .filter((item) => item.object_type === 'subscription' && item.object_id === subscriptionId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}
