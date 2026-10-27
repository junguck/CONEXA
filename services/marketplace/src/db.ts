import { createDb } from '@conexa/service-kit';
import type { ColumnType, Generated } from 'kysely';

import { env } from './config.js';

export interface ServiceCategoriesTable {
  id: Generated<number>;
  slug: string;
  name: string;
  parent_id: number | null;
}

export interface ServiceListingsTable {
  id: Generated<string>;
  owner_id: string;
  category_id: number;
  title: string;
  description: string;
  pricing: Generated<'fixed' | 'hourly'>;
  delivery_mode: 'online' | 'onsite' | 'either';
  location: string | null;
  tags: Generated<string[]>;
  status: Generated<'draft' | 'pending_review' | 'active' | 'paused' | 'archived'>;
  rating_avg: Generated<string>;
  rating_count: Generated<number>;
  boost_until: Date | null;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
  paused_reason: string | null;
}

export interface ListingPackagesTable {
  id: Generated<string>;
  listing_id: string;
  tier: 'basic' | 'standard' | 'premium';
  name: string;
  description: string | null;
  price_fcfa: number;
  delivery_days: number;
  revisions: Generated<number>;
}

export interface ListingAvailabilityTable {
  id: Generated<string>;
  listing_id: string;
  starts_at: Date;
  ends_at: Date;
  booked: Generated<boolean>;
}

export interface ListingFavoritesTable {
  user_id: string;
  listing_id: string;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface ServiceOrdersTable {
  id: Generated<string>;
  listing_id: string;
  package_id: string | null;
  slot_id: string | null;
  client_id: string;
  provider_id: string;
  requirements: string | null;
  status: Generated<
    | 'requested'
    | 'accepted'
    | 'funded'
    | 'in_progress'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'disputed'
  >;
  amount_fcfa: number;
  commission_pct: string;
  commission_fcfa: Generated<number>;
  revisions_used: Generated<number>;
  revisions_limit: Generated<number>;
  payment_id: string | null;
  delivered_at: Date | null;
  auto_validate_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface ServiceOrderEventsTable {
  id: Generated<string>;
  order_id: string;
  type: string;
  actor_id: string;
  meta: Generated<unknown>;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface OrderReviewsTable {
  id: Generated<string>;
  order_id: string;
  author_id: string;
  target_id: string;
  rating: number;
  comment: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface OrderDisputesTable {
  id: Generated<string>;
  order_id: string;
  opened_by: string;
  reason: string;
  evidence_upload_ids: Generated<string[]>;
  status: Generated<'open' | 'resolved' | 'dismissed'>;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface ListingBoostsTable {
  id: Generated<string>;
  listing_id: string;
  days: 3 | 7;
  payment_id: string | null;
  starts_at: Generated<Date>;
  ends_at: Date;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface MarketplaceDb {
  service_categories: ServiceCategoriesTable;
  service_listings: ServiceListingsTable;
  listing_packages: ListingPackagesTable;
  listing_availability: ListingAvailabilityTable;
  listing_favorites: ListingFavoritesTable;
  service_orders: ServiceOrdersTable;
  service_order_events: ServiceOrderEventsTable;
  order_reviews: OrderReviewsTable;
  order_disputes: OrderDisputesTable;
  listing_boosts: ListingBoostsTable;
}

const handle = createDb<MarketplaceDb>({
  connectionString: env.DATABASE_URL,
  schema: 'marketplace',
});

export const db = handle.db;
export const pingDatabase = handle.ping;
