import type { PlanAudience, SubscriptionStatus } from '@conexa/contracts';
import { invalidState, validationError } from '@conexa/errors';

export interface SubscriptionState {
  status: SubscriptionStatus;
  current_period_end: Date | null;
  grace_until?: Date | null;
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

/** 3 jours de grâce exactement (§7.4) : droits conservés après un impayé. */
export const GRACE_DAYS = 3;

export function graceUntil(now: Date): Date {
  return new Date(now.getTime() + GRACE_DAYS * 86_400_000);
}

/**
 * Pendant la grâce (`past_due`, `grace_until` à venir), les droits du plan
 * payant restent effectifs ; à l'échéance de la grâce, l'abonnement est expiré
 * et `hasRights` retombe au plan gratuit de l'audience.
 */
export function hasRights(subscription: SubscriptionState | undefined, now: Date): boolean {
  if (isActive(subscription, now)) {
    return true;
  }
  if (subscription?.status === 'past_due') {
    const graceEndsAt = subscription.grace_until;
    return graceEndsAt !== null && graceEndsAt !== undefined && graceEndsAt > now;
  }
  return false;
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

/**
 * Remise d'un code promo : pourcentage en points entiers, plancher 0.
 * L'arrondi va toujours au client (plancher), la base au maximum 100.
 */
export function promoDiscount(baseFcfa: number, discountPct: number): number {
  return Math.floor((baseFcfa * discountPct) / 100);
}

export function invoiceTotals(baseFcfa: number, discountPct: number) {
  if (!Number.isInteger(baseFcfa) || baseFcfa < 0) {
    throw validationError('Base de facture invalide : entier FCFA positif requis');
  }
  const discount = Math.min(baseFcfa, promoDiscount(baseFcfa, discountPct));
  return { base_fcfa: baseFcfa, discount_fcfa: discount, total_fcfa: baseFcfa - discount };
}

/** Éligibilité d'un code promo, au moment de la souscription. */
export function promoAcceptable(
  promo: {
    active: boolean;
    starts_at: Date | null;
    ends_at: Date | null;
    max_redemptions: number | null;
    redeemed_count: number;
  } | null | undefined,
  now: Date,
  expectedCode: string,
  foundCode: string,
): void {
  if (promo === null || promo === undefined) {
    throw validationError(`Code promo inconnu : ${expectedCode}`);
  }
  if (foundCode !== expectedCode) {
    throw validationError('Code promo incohérent');
  }
  if (!promo.active) {
    throw validationError(`Code promo désactivé : ${expectedCode}`);
  }
  if (promo.starts_at !== null && promo.starts_at > now) {
    throw validationError(`Code promo pas encore ouvert : ${expectedCode}`);
  }
  if (promo.ends_at !== null && promo.ends_at <= now) {
    throw validationError(`Code promo expiré : ${expectedCode}`);
  }
  if (promo.max_redemptions !== null && promo.redeemed_count >= promo.max_redemptions) {
    throw validationError(`Code promo épuisé : ${expectedCode}`);
  }
}

/**
 * Transitions acceptées par le balayage quotidien (T-0026).
 * `active` échu → `past_due` ; `past_due` échu → `expired` ;
 * résiliation différée à la fin de période → `cancelled`.
 */
export function dueTransition(
  status: SubscriptionStatus,
  periodEndAt: Date | null,
  graceUntilAt: Date | null,
  cancelAtPeriodEnd: boolean,
  now: Date,
): 'past_due' | 'expired' | 'cancelled' | null {
  const ended = periodEndAt !== null && periodEndAt <= now;
  if (status === 'active' && ended) {
    return cancelAtPeriodEnd ? 'cancelled' : 'past_due';
  }
  if (status === 'past_due' && graceUntilAt !== null && graceUntilAt <= now) {
    return 'expired';
  }
  return null;
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
