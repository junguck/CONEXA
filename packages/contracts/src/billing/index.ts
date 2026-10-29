import { z } from 'zod';

import { MoneySchema } from '../common/money.js';

/**
 * Billing : plans, abonnements et droits (F3.4). Les services métier ne lisent
 * jamais un taux en dur : ils demandent les droits effectifs de l'utilisateur.
 */

export const PLAN_AUDIENCES = ['student', 'organizer', 'restaurant', 'partner'] as const;
export const PlanAudienceSchema = z.enum(PLAN_AUDIENCES);
export type PlanAudience = z.infer<typeof PlanAudienceSchema>;

export const BILLING_PERIODS = ['monthly', 'yearly'] as const;
export const BillingPeriodSchema = z.enum(BILLING_PERIODS);
export type BillingPeriod = z.infer<typeof BillingPeriodSchema>;

export const SUBSCRIPTION_STATUSES = [
  'pending',
  'active',
  'past_due',
  'expired',
  'cancelled',
] as const;
export const SubscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

/** Droits effectifs : c'est ce que Marketplace, Talents et Dating consomment. */
export const EntitlementsSchema = z.object({
  plan_code: z.string().min(2),
  commission_pct: z.number().int().min(0).max(30),
  max_active_listings: z.number().int().min(0).max(100),
  picks_per_week: z.number().int().min(0).max(20),
  boost_discount_pct: z.number().int().min(0).max(100),
  event_commission_pct: z.number().int().min(0).max(30),
});
export type Entitlements = z.infer<typeof EntitlementsSchema>;

export const PlanSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(2).max(80),
  audience: PlanAudienceSchema,
  price_fcfa: MoneySchema,
  period: BillingPeriodSchema,
  entitlements: EntitlementsSchema,
  /** Plan par défaut de son audience : aucun paiement requis. */
  is_default: z.boolean(),
});
export type Plan = z.infer<typeof PlanSchema>;

export const SubscriptionSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  plan_code: z.string(),
  status: SubscriptionStatusSchema,
  payment_id: z.uuid().nullable(),
  started_at: z.iso.datetime().nullable(),
  current_period_end: z.iso.datetime().nullable(),
  /** Fin de la grâce après un renouvellement manqué : droits conservés jusque-là. */
  grace_until: z.iso.datetime().nullable(),
  /** Résiliation demandée, effective à la fin de la période en cours. */
  cancel_at_period_end: z.boolean(),
  cancelled_at: z.iso.datetime().nullable(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

export const SubscribeSchema = z.object({
  plan_code: z.string().min(2).max(40),
  /** Code promotionnel appliqué à la facture (facultatif). */
  promo_code: z.string().min(2).max(40).optional(),
});
export type SubscribeInput = z.infer<typeof SubscribeSchema>;

export const INVOICE_STATUSES = ['open', 'paid', 'void'] as const;
export const InvoiceStatusSchema = z.enum(INVOICE_STATUSES);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

/**
 * Facture d'abonnement : montants entiers en FCFA, jamais négatifs. `number`
 * est un numéro séquentiel lisible, attribué par la base.
 */
export const InvoiceSchema = z.object({
  id: z.uuid(),
  subscription_id: z.uuid(),
  user_id: z.uuid(),
  number: z.string().regex(/^INV-/),
  plan_code: z.string(),
  base_fcfa: MoneySchema,
  discount_fcfa: MoneySchema,
  total_fcfa: MoneySchema,
  promo_code: z.string().nullable(),
  status: InvoiceStatusSchema,
  payment_id: z.uuid().nullable(),
  issued_at: z.iso.datetime(),
  paid_at: z.iso.datetime().nullable(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

/** Un code promo : pourcentage en points entiers, fenêtre et plafond de fois. */
export const PromoCodeSchema = z.object({
  code: z.string().min(2).max(40),
  discount_pct: z.number().int().min(1).max(100),
  max_redemptions: z.number().int().positive().nullable(),
  redeemed_count: z.number().int().nonnegative(),
  starts_at: z.iso.datetime().nullable(),
  ends_at: z.iso.datetime().nullable(),
  active: z.boolean(),
});
export type PromoCode = z.infer<typeof PromoCodeSchema>;

/** Le plan payant s'active quand Payments confirme le paiement associé. */
export const ActivateSubscriptionSchema = z.object({
  payment_id: z.uuid(),
});
export type ActivateSubscriptionInput = z.infer<typeof ActivateSubscriptionSchema>;

/** Plan gratuit de chaque audience : jamais de blocage total d'un compte. */
export const DEFAULT_PLAN_BY_AUDIENCE: Record<PlanAudience, string> = {
  student: 'student_free',
  organizer: 'student_free',
  restaurant: 'restaurant_free',
  partner: 'partner_free',
};

/**
 * Événements publiés par Billing (`ARCHITECTURE.md` §7.1).
 * `entitlements.changed` purge le cache de 60 s des consommateurs ; il ne porte
 * aucun droit en clair, seulement de quoi invalider et relire.
 */
export const BILLING_EVENTS = {
  entitlementsChanged: 'entitlements.changed',
  subscriptionActivated: 'subscription.activated',
  subscriptionPastDue: 'subscription.past_due',
  subscriptionExpired: 'subscription.expired',
  subscriptionCancelled: 'subscription.cancelled',
  invoiceIssued: 'invoice.issued',
} as const;

export const EntitlementsChangedEventSchema = z.object({
  subject_kind: z.enum(['user', 'team', 'partner']),
  subject_id: z.uuid(),
  audience: PlanAudienceSchema,
  plan_code: z.string().min(2),
  reason: z.enum(['activated', 'cancelled', 'expired', 'plan_changed', 'grant']),
  changed_at: z.iso.datetime({ offset: true }),
});
export type EntitlementsChangedEvent = z.infer<typeof EntitlementsChangedEventSchema>;

export const SubscriptionActivatedEventSchema = z.object({
  subscription_id: z.uuid(),
  user_id: z.uuid(),
  plan_code: z.string().min(2),
  current_period_end: z.iso.datetime({ offset: true }),
});

export const SubscriptionExpiredEventSchema = z.object({
  subscription_id: z.uuid(),
  user_id: z.uuid(),
  plan_code: z.string().min(2),
  reason: z.enum(['payment_failed', 'cancelled', 'period_ended']),
});

export const SubscriptionPastDueEventSchema = z.object({
  subscription_id: z.uuid(),
  user_id: z.uuid(),
  plan_code: z.string().min(2),
  grace_until: z.iso.datetime({ offset: true }),
});

export const InvoiceIssuedEventSchema = z.object({
  invoice_id: z.uuid(),
  subscription_id: z.uuid(),
  user_id: z.uuid(),
  number: z.string(),
  base_fcfa: MoneySchema,
  discount_fcfa: MoneySchema,
  total_fcfa: MoneySchema,
});
