import type { PlanAudience, SubscriptionStatus } from '@conexa/contracts';
import { invalidState } from '@conexa/errors';

export interface SubscriptionState {
  status: SubscriptionStatus;
  current_period_end: Date | null;
}

/**
 * Un abonnement donne ses droits tant que le statut est `active` **et** que la
 * période n'est pas échue. Une période échue ne coupe pas l'accès au plan
 * gratuit : `entitlementsFor` retombe sur le plan par défaut de l'audience.
 */
export function isActive(subscription: SubscriptionState | undefined, now: Date): boolean {
  if (!subscription || subscription.status !== 'active') {
    return false;
  }
  return subscription.current_period_end === null || subscription.current_period_end > now;
}

/** On n'active qu'un abonnement encore en attente de paiement. */
export function assertCanActivate(status: SubscriptionStatus): void {
  if (status !== 'pending') {
    throw invalidState(`Abonnement déjà traité (${status})`);
  }
}

/** Fin de période : gratuite ou payante, la règle est la même. */
export function periodEnd(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 86_400_000);
}

/** Un abonnement payant doit référencer un paiement, un gratuit jamais. */
export function assertPaymentMatchesPlan(priceFcfa: number, hasPayment: boolean): void {
  if (priceFcfa > 0 && !hasPayment) {
    throw invalidState('Plan payant : paiement requis avant activation');
  }
  if (priceFcfa === 0 && hasPayment) {
    throw invalidState('Plan gratuit : aucun paiement attendu');
  }
}

/** Qui peut souscrire quoi : un plan restaurant n'est pas pour un étudiant. */
export function canSubscribe(role: string, audience: PlanAudience): boolean {
  if (audience === 'partner') {
    return role === 'partner_staff';
  }
  if (audience === 'restaurant') {
    return role === 'restaurant_staff';
  }
  return true;
}

/** Audience du plan gratuit de repli, par rôle de l'utilisateur. */
export function fallbackAudience(role: string): PlanAudience {
  if (role === 'partner_staff') {
    return 'partner';
  }
  if (role === 'restaurant_staff') {
    return 'restaurant';
  }
  return 'student';
}
