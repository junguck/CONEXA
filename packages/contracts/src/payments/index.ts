import { z } from 'zod';

import { MoneySchema } from '../common/money.js';

/** Même format que le compte Identity : un numéro qui paie est un numéro vérifié. */
const PhoneSchema = z.string().regex(/^\+237[6-9]\d{8}$/, 'Numéro au format +2376XXXXXXXX');

/**
 * Payments : encaissement, séquestre, libération et remboursement
 * (`docs/product/API.md` §3.13, F3.1 à F3.3). Aucun service métier ne touche
 * d'argent lui-même : il appelle Payments et garde l'identifiant de paiement.
 */

export const PAYMENT_PROVIDERS = ['mtn_momo', 'orange_money', 'mock'] as const;
export const PaymentProviderSchema = z.enum(PAYMENT_PROVIDERS);
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;

export const PAYMENT_STATUSES = [
  'pending',
  'escrow',
  'released',
  'refund_pending',
  'refunded',
  'failed',
] as const;
export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PAYMENT_OBJECT_TYPES = [
  'date',
  'mission',
  'order',
  'ticket',
  'boost',
  'subscription',
] as const;
export const PaymentObjectTypeSchema = z.enum(PAYMENT_OBJECT_TYPES);
export type PaymentObjectType = z.infer<typeof PaymentObjectTypeSchema>;

export const CreatePaymentSchema = z.object({
  object_type: PaymentObjectTypeSchema,
  object_id: z.uuid(),
  amount_fcfa: MoneySchema,
  provider: PaymentProviderSchema,
  /** Numéro qui paie (le payeur, jamais le bénéficiaire). */
  phone_msisdn: PhoneSchema,
  description: z.string().max(160).optional(),
  /** Rejeu sûr : deux appels avec la même clé ne créent qu'un paiement. */
  idempotency_key: z.string().min(8).max(128).optional(),
});
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

export const ReleasePaymentSchema = z.object({
  commission_fcfa: MoneySchema,
  net_fcfa: MoneySchema,
  /** Compte qui reçoit le net (identifiant interne, jamais un numéro). */
  beneficiary_ref: z.string().min(1).max(128).optional(),
});
export type ReleasePaymentInput = z.infer<typeof ReleasePaymentSchema>;

export const RefundPaymentSchema = z.object({
  reason: z.string().max(160).optional(),
});
export type RefundPaymentInput = z.infer<typeof RefundPaymentSchema>;

export const PaymentSchema = z.object({
  id: z.uuid(),
  object_type: PaymentObjectTypeSchema,
  object_id: z.uuid(),
  payer_id: z.uuid(),
  amount_fcfa: MoneySchema,
  commission_fcfa: MoneySchema,
  net_fcfa: MoneySchema,
  provider: PaymentProviderSchema,
  status: PaymentStatusSchema,
  payment_url: z.string().nullable(),
  created_at: z.iso.datetime(),
  released_at: z.iso.datetime().nullable(),
  refunded_at: z.iso.datetime().nullable(),
});
export type Payment = z.infer<typeof PaymentSchema>;

/** Notification envoyée par l'agrégateur (Campay en production, mock en dev). */
export const PaymentWebhookSchema = z.object({
  reference: z.string().min(3),
  status: z.enum(['successful', 'failed']),
  amount_fcfa: MoneySchema.optional(),
  external_reference: z.string().optional(),
});
export type PaymentWebhook = z.infer<typeof PaymentWebhookSchema>;

/** Comptes du grand livre : tout mouvement est un débit et un crédit. */
export const LEDGER_ACCOUNTS = {
  cash: 'CASH',
  escrow: 'ESCROW_LIABILITY',
  revenue: 'REVENUE_COMMISSION',
  payable: 'PROVIDER_PAYABLE',
} as const;

export const LedgerLineSchema = z.object({
  account: z.string().min(1),
  direction: z.enum(['debit', 'credit']),
  amount_fcfa: MoneySchema,
});
export type LedgerLine = z.infer<typeof LedgerLineSchema>;

export const LedgerBalanceSchema = z.object({
  /** Écart entre débits et crédits : doit toujours être 0. */
  imbalance_fcfa: z.number().int(),
  accounts: z.array(
    z.object({
      account: z.string(),
      debit_fcfa: z.number().int(),
      credit_fcfa: z.number().int(),
    }),
  ),
});
export type LedgerBalance = z.infer<typeof LedgerBalanceSchema>;
