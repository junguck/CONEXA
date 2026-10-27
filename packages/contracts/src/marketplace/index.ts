import { z } from 'zod';

import { IdSchema, IsoDateSchema } from '../common/identity.js';
import { PageQuerySchema } from '../common/pagination.js';

export const LISTING_STATUSES = [
  'draft',
  'pending_review',
  'active',
  'paused',
  'archived',
] as const;
export const ListingStatusSchema = z.enum(LISTING_STATUSES);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const PRICING_MODES = ['fixed', 'hourly'] as const;
export const DeliveryModes = ['online', 'onsite', 'either'] as const;
export const DeliveryModeSchema = z.enum(DeliveryModes);
export type DeliveryMode = z.infer<typeof DeliveryModeSchema>;

export const PACKAGE_TIERS = ['basic', 'standard', 'premium'] as const;
export const PackageTierSchema = z.enum(PACKAGE_TIERS);
export type PackageTier = z.infer<typeof PackageTierSchema>;

export const PackageSchema = z.object({
  id: IdSchema.optional(),
  tier: PackageTierSchema,
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(400).nullable().optional(),
  price_fcfa: z.number().int().min(500).max(5_000_000),
  delivery_days: z.number().int().min(1).max(60),
  revisions: z.number().int().min(0).max(10),
});
export type PackageInput = z.infer<typeof PackageSchema>;

export const ServiceListingSchema = z.object({
  id: IdSchema,
  owner_id: IdSchema,
  category_id: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  pricing: z.enum(PRICING_MODES),
  delivery_mode: DeliveryModeSchema,
  location: z.string().nullable(),
  tags: z.array(z.string()),
  status: ListingStatusSchema,
  rating_avg: z.number(),
  rating_count: z.number().int().nonnegative(),
  boost_until: IsoDateSchema.nullable(),
  packages: z.array(PackageSchema),
  created_at: IsoDateSchema,
});
export type ServiceListing = z.infer<typeof ServiceListingSchema>;

export const CreateListingSchema = z.object({
  category_id: z.number().int().positive(),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(3000),
  pricing: z.enum(PRICING_MODES).default('fixed'),
  delivery_mode: DeliveryModeSchema,
  location: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(2).max(24)).max(8).default([]),
  packages: z.array(PackageSchema).min(1).max(3),
});

export const UpdateListingSchema = z
  .object({
    title: z.string().trim().min(5).max(120).optional(),
    description: z.string().trim().min(20).max(3000).optional(),
    location: z.string().trim().max(120).nullable().optional(),
    tags: z.array(z.string().trim().min(2).max(24)).max(8).optional(),
    delivery_mode: DeliveryModeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ à modifier' });

export const ListingSearchSchema = PageQuerySchema.extend({
  q: z.string().trim().min(1).max(80).optional(),
  category: z.coerce.number().int().positive().optional(),
  min_price: z.coerce.number().int().nonnegative().optional(),
  max_price: z.coerce.number().int().nonnegative().optional(),
  delivery_mode: DeliveryModeSchema.optional(),
  sort: z.enum(['relevance', 'rating', 'price', 'recent']).default('recent'),
});
export type ListingSearchQuery = z.infer<typeof ListingSearchSchema>;

export const AvailabilitySlotSchema = z.object({
  starts_at: IsoDateSchema,
  ends_at: IsoDateSchema,
});

export const PutAvailabilitySchema = z.object({
  slots: z.array(AvailabilitySlotSchema).max(50),
});

export const ORDER_STATUSES = [
  'requested',
  'accepted',
  'funded',
  'in_progress',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
] as const;
export const OrderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const ServiceOrderSchema = z.object({
  id: IdSchema,
  listing_id: IdSchema,
  package_id: IdSchema.nullable(),
  slot_id: IdSchema.nullable(),
  client_id: IdSchema,
  provider_id: IdSchema,
  requirements: z.string().nullable(),
  status: OrderStatusSchema,
  amount_fcfa: z.number().int().nonnegative(),
  commission_pct: z.number(),
  commission_fcfa: z.number().int().nonnegative(),
  provider_net_fcfa: z.number().int().nonnegative(),
  revisions_used: z.number().int().nonnegative(),
  revisions_limit: z.number().int().nonnegative(),
  auto_validate_at: IsoDateSchema.nullable(),
  created_at: IsoDateSchema,
});
export type ServiceOrder = z.infer<typeof ServiceOrderSchema>;

export const CreateOrderSchema = z.object({
  listing_id: IdSchema,
  package_id: IdSchema.optional(),
  slot_id: IdSchema.optional(),
  requirements: z.string().trim().max(2000).optional(),
});

export const PayOrderSchema = z.object({
  provider: z.enum(['mtn_momo', 'orange_money']),
  phone_msisdn: z.string().min(9).max(15),
});

export const DeliverOrderSchema = z.object({
  note: z.string().trim().max(1000).optional(),
  file_upload_ids: z.array(IdSchema).max(10).default([]),
});

export const RevisionSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export const CancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const DisputeOrderSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
  evidence_upload_ids: z.array(IdSchema).max(10).default([]),
});

export const OrderReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(600).optional(),
});

export const OrderEventSchema = z.object({
  type: z.string(),
  actor_id: IdSchema,
  at: IsoDateSchema,
  meta: z.record(z.string(), z.unknown()),
});
export type OrderEvent = z.infer<typeof OrderEventSchema>;

export const ORDER_AUTO_VALIDATE_HOURS = 72;
export const DEFAULT_SERVICE_COMMISSION_PCT = 8;

export type CreateListingInput = z.infer<typeof CreateListingSchema>;
export type UpdateListingInput = z.infer<typeof UpdateListingSchema>;
