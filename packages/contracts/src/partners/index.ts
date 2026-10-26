import { z } from 'zod';

import { MoneySchema } from '../common/money.js';

/**
 * Partenaires (F4.1, F5.7) : organisations, lieux, menus, formules, créneaux
 * et offres. Un lieu appartient à une organisation ; une offre est émise par
 * une organisation et consommée par un utilisateur, une seule fois.
 */

export const ORGANISATION_KINDS = ['restaurant', 'venue', 'shop', 'service'] as const;
export const OrganisationKindSchema = z.enum(ORGANISATION_KINDS);
export type OrganisationKind = z.infer<typeof OrganisationKindSchema>;

export const PARTNER_STATUSES = ['pending', 'active', 'suspended'] as const;
export const PartnerStatusSchema = z.enum(PARTNER_STATUSES);
export type PartnerStatus = z.infer<typeof PartnerStatusSchema>;

export const CreateOrganisationSchema = z.object({
  name: z.string().min(2).max(120),
  kind: OrganisationKindSchema,
  /** Ville affichée ; elle est stockée normalisée (minuscules, sans accents). */
  city: z.string().min(2).max(80),
  contact_whatsapp: z
    .string()
    .regex(/^\+2376\d{8}$/, 'Numéro camerounais attendu (+2376XXXXXXXX)'),
  /** Taux négocié au contrat, lu par Billing pour les reversements. */
  commission_pct: z.number().int().min(0).max(30).default(10),
});
export type CreateOrganisationInput = z.infer<typeof CreateOrganisationSchema>;

export const OrganisationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: OrganisationKindSchema,
  city: z.string(),
  status: PartnerStatusSchema,
  commission_pct: z.number().int(),
  created_at: z.iso.datetime(),
});
export type Organisation = z.infer<typeof OrganisationSchema>;

/** Validation par l'administration (F1.3, F5.10) : un partenaire ne s'auto-active pas. */
export const PartnerStatusUpdateSchema = z.object({ status: PartnerStatusSchema });
export type PartnerStatusUpdateInput = z.infer<typeof PartnerStatusUpdateSchema>;

export const CreateVenueSchema = z.object({
  name: z.string().min(2).max(120),
  kind: z.enum(['restaurant', 'terrain', 'salle', 'bar']),
  city: z.string().min(2).max(80),
  address: z.string().min(3).max(200),
  capacity: z.number().int().min(1).max(5000),
  /** Prix indicatif d'un créneau ; les formules peuvent le remplacer. */
  price_per_hour_fcfa: MoneySchema.optional(),
});
export type CreateVenueInput = z.infer<typeof CreateVenueSchema>;

export const VenueSchema = z.object({
  id: z.uuid(),
  organisation_id: z.uuid(),
  name: z.string(),
  kind: z.string(),
  city: z.string(),
  address: z.string(),
  capacity: z.number().int(),
  price_per_hour_fcfa: z.number().int().nullable(),
  status: PartnerStatusSchema,
  created_at: z.iso.datetime(),
});
export type Venue = z.infer<typeof VenueSchema>;

export const CreateMenuItemSchema = z.object({
  name: z.string().min(2).max(120),
  price_fcfa: MoneySchema,
  category: z.enum(['plat', 'boisson', 'dessert', 'autre']).default('autre'),
  available: z.boolean().default(true),
});
export type CreateMenuItemInput = z.infer<typeof CreateMenuItemSchema>;

export const MenuItemSchema = z.object({
  id: z.uuid(),
  venue_id: z.uuid(),
  name: z.string(),
  price_fcfa: z.number().int(),
  category: z.string(),
  available: z.boolean(),
});
export type MenuItem = z.infer<typeof MenuItemSchema>;

export const CreateFormulaSchema = z.object({
  name: z.string().min(2).max(120),
  price_fcfa: MoneySchema,
  min_people: z.number().int().min(1).max(500).default(1),
  includes: z.array(z.string().min(1).max(60)).max(12).default([]),
});
export type CreateFormulaInput = z.infer<typeof CreateFormulaSchema>;

export const FormulaSchema = z.object({
  id: z.uuid(),
  venue_id: z.uuid(),
  name: z.string(),
  price_fcfa: z.number().int(),
  min_people: z.number().int(),
  includes: z.array(z.string()),
});
export type Formula = z.infer<typeof FormulaSchema>;

export const CreateSlotSchema = z.object({
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  capacity: z.number().int().min(1).max(5000).default(1),
  price_fcfa: MoneySchema.optional(),
});
export type CreateSlotInput = z.infer<typeof CreateSlotSchema>;

export const SlotSchema = z.object({
  id: z.uuid(),
  venue_id: z.uuid(),
  starts_at: z.iso.datetime(),
  ends_at: z.iso.datetime(),
  capacity: z.number().int(),
  price_fcfa: z.number().int().nullable(),
  status: z.enum(['open', 'booked', 'closed']),
});
export type Slot = z.infer<typeof SlotSchema>;

export const OFFER_KINDS = ['percent', 'fixed'] as const;
export const OfferKindSchema = z.enum(OFFER_KINDS);

export const CreateOfferSchema = z.object({
  title: z.string().min(2).max(120),
  /** `percent` : valeur en points ; `fixed` : montant en FCFA. */
  kind: OfferKindSchema,
  value: z.number().int().min(1).max(100_000),
  city: z.string().min(2).max(80),
  /** Nombre d'utilisations totales ; absent = illimité. */
  quota: z.number().int().min(1).max(100_000).optional(),
  valid_until: z.iso.datetime({ offset: true }).optional(),
});
export type CreateOfferInput = z.infer<typeof CreateOfferSchema>;

export const OfferSchema = z.object({
  id: z.uuid(),
  organisation_id: z.uuid(),
  title: z.string(),
  kind: OfferKindSchema,
  value: z.number().int(),
  city: z.string(),
  quota: z.number().int().nullable(),
  redeemed_count: z.number().int(),
  valid_until: z.iso.datetime().nullable(),
  created_at: z.iso.datetime(),
});
export type Offer = z.infer<typeof OfferSchema>;

export const RedemptionSchema = z.object({
  code: z.string().min(6),
  offer_id: z.uuid(),
  redeemed_at: z.iso.datetime(),
});
export type Redemption = z.infer<typeof RedemptionSchema>;

export const RedeemOfferResultSchema = z.object({
  redemption: RedemptionSchema,
  offer: OfferSchema,
});
export type RedeemOfferResult = z.infer<typeof RedeemOfferResultSchema>;

export const VenueDetailSchema = VenueSchema.extend({
  menu: z.array(MenuItemSchema),
  formulas: z.array(FormulaSchema),
  next_slots: z.array(SlotSchema),
});
export type VenueDetail = z.infer<typeof VenueDetailSchema>;

export type OfferBlockedReason = 'expired' | 'exhausted';
