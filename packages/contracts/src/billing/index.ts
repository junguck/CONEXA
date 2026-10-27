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

export const SUBSCRIPTION_STATUSES = ['pending', 'active', 'past_due', 'cancelled'] as const;
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
  cancelled_at: z.iso.datetime().nullable(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

export const SubscribeSchema = z.object({
  plan_code: z.string().min(2).max(40),
});
export type SubscribeInput = z.infer<typeof SubscribeSchema>;

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
