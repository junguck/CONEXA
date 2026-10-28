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

/**
 * Notification normalisée d'un agrégateur. Campay envoie `SUCCESSFUL`/`FAILED`
 * en majuscules, un montant en chaîne et une signature JWT dans le corps : le
 * service normalise avant validation (services/payments/src/webhooks.rules.ts).
 */
export const PaymentWebhookSchema = z.object({
  reference: z.string().min(3),
  status: z.enum(['successful', 'failed', 'pending']),
  amount_fcfa: MoneySchema.optional(),
  external_reference: z.string().optional(),
});
export type PaymentWebhook = z.infer<typeof PaymentWebhookSchema>;

/**
 * Statut rendu par l'agrégateur pour une référence. `unknown` couvre une panne
 * ou une réponse illisible : on ne change jamais d'état sur `unknown`.
 */
export const PROVIDER_STATUSES = ['pending', 'successful', 'failed', 'unknown'] as const;
export const ProviderStatusSchema = z.enum(PROVIDER_STATUSES);
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;

/** Opérateurs mobile money acceptés (MTN et Orange uniquement, ER102 sinon). */
export const MOBILE_MONEY_OPERATORS = ['mtn_momo', 'orange_money'] as const;
export const MobileMoneyOperatorSchema = z.enum(MOBILE_MONEY_OPERATORS);
export type MobileMoneyOperator = z.infer<typeof MobileMoneyOperatorSchema>;

/**
 * Numéro camerounais normalisé pour l'agrégateur : indicatif pays, sans « + »
 * (`2376XXXXXXXX`, ER101 sinon). Un numéro qui n'est pas mobile est refusé avant
 * tout appel : jamais une découverte d'erreur côté fournisseur.
 */
export const MsisdnSchema = z
  .string()
  .regex(/^2376[5-9]\d{7}$/, 'Numéro attendu au format 2376XXXXXXXX');

export function normalizeMsisdn(input: string): string {
  const digits = input.replace(/[^\d]/g, '');
  if (digits.startsWith('00237')) {
    return digits.slice(2);
  }
  return digits.startsWith('237') ? digits : `237${digits}`;
}

/** Masque un numéro pour toute réponse ou journal : jamais de numéro en clair. */
export function maskMsisdn(msisdn: string): string {
  if (msisdn.length < 8) {
    return '••••';
  }
  return `${msisdn.slice(0, 5)}••••${msisdn.slice(-2)}`;
}

/**
 * Compte de reversement d'un bénéficiaire : **distinct** du numéro WhatsApp.
 * L'opérateur est déclaré par le bénéficiaire, jamais deviné par un préfixe.
 */
export const CreatePayoutAccountSchema = z.object({
  operator: MobileMoneyOperatorSchema,
  /** Numéro MoMo ou Orange Money dédié aux reversements. */
  msisdn: MsisdnSchema,
});
export type CreatePayoutAccountInput = z.infer<typeof CreatePayoutAccountSchema>;

export const PayoutAccountSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid(),
  operator: MobileMoneyOperatorSchema,
  /** Toujours masqué : le numéro en clair ne quitte pas le service. */
  msisdn_masked: z.string(),
  created_at: z.iso.datetime(),
});
export type PayoutAccount = z.infer<typeof PayoutAccountSchema>;

/**
 * Reversement : un décaissement par bénéficiaire **et par opérateur**. Une
 * ligne `queued` est un travail restant, pas une perte d'argent.
 */
export const PAYOUT_STATUSES = ['queued', 'processing', 'sent', 'failed'] as const;
export const PayoutStatusSchema = z.enum(PAYOUT_STATUSES);
export type PayoutStatus = z.infer<typeof PayoutStatusSchema>;

export const PayoutFailureReasonSchema = z.enum([
  'beneficiary_account_missing',
  'insufficient_provider_balance',
  'provider_refused',
  'expired',
]);
export type PayoutFailureReason = z.infer<typeof PayoutFailureReasonSchema>;

export const PayoutSchema = z.object({
  id: z.uuid(),
  payment_id: z.uuid(),
  beneficiary_id: z.string(),
  operator: MobileMoneyOperatorSchema,
  amount_fcfa: MoneySchema,
  status: PayoutStatusSchema,
  attempts: z.number().int().nonnegative(),
  failure_reason: PayoutFailureReasonSchema.nullable(),
  provider_reference: z.string().nullable(),
  created_at: z.iso.datetime(),
  sent_at: z.iso.datetime().nullable(),
});
export type Payout = z.infer<typeof PayoutSchema>;

/** Ligne de rapprochement : le grand livre contre le solde de l'agrégateur. */
export const ReconciliationStatusSchema = z.enum(['ok', 'mismatch']);
export type ReconciliationStatus = z.infer<typeof ReconciliationStatusSchema>;

export const ReconciliationSchema = z.object({
  id: z.uuid(),
  day: z.string(),
  operator: z.string(),
  ledger_cash_fcfa: z.number().int(),
  provider_balance_fcfa: z.number().int(),
  /** Écart = solde fournisseur − solde comptable ; 0 attendu. */
  variance_fcfa: z.number().int(),
  status: ReconciliationStatusSchema,
  created_at: z.iso.datetime(),
});
export type Reconciliation = z.infer<typeof ReconciliationSchema>;

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
  /** Opérateur mobile money de la ligne de caisse : le rapprochement est par opérateur. */
  operator: MobileMoneyOperatorSchema.optional(),
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

/**
 * Événements publiés par Payments (`ARCHITECTURE.md` §6). Aucun numéro, aucun
 * nom : l'identifiant du paiement et l'objet suffisent. Le schéma vit ici, avec
 * le contrat, pour que tous les services importent la même définition.
 */
export const PAYMENTS_EVENTS = {
  escrowed: 'payment.escrowed',
  failed: 'payment.failed',
  refunded: 'payment.refunded',
  released: 'payment.released',
  payoutSent: 'payout.sent',
  payoutFailed: 'payout.failed',
  reconciliationMismatched: 'payment.reconciliation.mismatched',
} as const;

export const PaymentEscrowedEventSchema = z.object({
  payment_id: z.uuid(),
  object_type: z.string().min(1),
  object_id: z.uuid(),
  payer_id: z.uuid(),
  amount_fcfa: MoneySchema,
});

export const PaymentFailedEventSchema = z.object({
  payment_id: z.uuid(),
  object_type: z.string().min(1),
  object_id: z.uuid(),
  reason: z.enum(['provider_failure', 'expired', 'amount_mismatch']),
});

export const PaymentReleasedEventSchema = z.object({
  payment_id: z.uuid(),
  object_id: z.uuid(),
  net_fcfa: MoneySchema,
  commission_fcfa: MoneySchema,
});

export const PaymentRefundedEventSchema = z.object({
  payment_id: z.uuid(),
  amount_fcfa: MoneySchema,
});

export const PayoutSentEventSchema = z.object({
  payout_id: z.uuid(),
  payment_id: z.uuid(),
  operator: MobileMoneyOperatorSchema,
  amount_fcfa: MoneySchema,
});

export const PayoutFailedEventSchema = z.object({
  payout_id: z.uuid().nullable(),
  payment_id: z.uuid(),
  reason: PayoutFailureReasonSchema,
});

/** Alerte de rapprochement : les deux soldes sont publics, le détail ne l'est pas. */
export const ReconciliationMismatchedEventSchema = z.object({
  day: z.string().min(10),
  operator: z.string().min(1),
  ledger_cash_fcfa: z.number().int(),
  provider_balance_fcfa: z.number().int(),
  variance_fcfa: z.number().int(),
});
