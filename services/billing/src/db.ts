import type {
  BillingPeriod,
  Entitlements,
  PlanAudience,
  SubscriptionStatus,
} from '@conexa/contracts';
import { assertEntitlements } from '@conexa/entitlements';
import { createDb } from '@conexa/service-kit';
import type { ColumnType, Selectable } from 'kysely';

import { env } from './config.js';

export interface PlansTable {
  code: string;
  name: string;
  audience: PlanAudience;
  price_fcfa: number;
  period: BillingPeriod;
  commission_pct: number;
  max_active_listings: number;
  picks_per_week: number;
  boost_discount_pct: number;
  event_commission_pct: number;
  is_default: boolean;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export type PlanRow = Selectable<PlansTable>;

export interface SubscriptionsTable {
  id: string;
  user_id: string;
  plan_code: string;
  status: SubscriptionStatus;
  payment_id: string | null;
  started_at: Date | null;
  current_period_end: Date | null;
  cancelled_at: Date | null;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface Database {
  plans: PlansTable;
  subscriptions: SubscriptionsTable;
}

const handle = createDb<Database>({ connectionString: env.DATABASE_URL, schema: 'billing' });

export const db = handle.db;
export const pingDatabase = handle.ping;

export function entitlementsOf(plan: PlanRow): Entitlements {
  // Validation par le paquet partagé : un plan incomplet fait échouer la lecture
  // au lieu de produire des droits silencieusement faux.
  return assertEntitlements({
    plan_code: plan.code,
    commission_pct: plan.commission_pct,
    max_active_listings: plan.max_active_listings,
    picks_per_week: plan.picks_per_week,
    boost_discount_pct: plan.boost_discount_pct,
    event_commission_pct: plan.event_commission_pct,
  });
}
