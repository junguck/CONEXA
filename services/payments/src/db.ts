import type {
  MobileMoneyOperator,
  PaymentObjectType,
  PaymentProvider,
  PaymentStatus,
  PayoutStatus,
  ReconciliationStatus,
} from '@conexa/contracts';
import { createDb } from '@conexa/service-kit';
import type { ColumnType, Generated } from 'kysely';

import { env } from './config.js';

export interface PaymentsTable {
  id: Generated<string>;
  object_type: PaymentObjectType;
  object_id: string;
  payer_id: string;
  amount_fcfa: number;
  commission_fcfa: number;
  net_fcfa: number;
  provider: PaymentProvider;
  status: PaymentStatus;
  external_reference: string | null;
  payment_url: string | null;
  idempotency_key: string | null;
  description: string | null;
  /** Numéro du payeur, pour un remboursement par décaissement. Jamais exposé. */
  payer_msisdn: string | null;
  next_check_at: Date | null;
  checks: Generated<number>;
  expires_at: Date | null;
  failure_reason: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
  released_at: Date | null;
  refunded_at: Date | null;
}

export interface JournalEntriesTable {
  id: Generated<string>;
  reference_type: string;
  reference_id: string;
  memo: string;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface LedgerLinesTable {
  id: Generated<string>;
  entry_id: string;
  account: string;
  direction: 'debit' | 'credit';
  amount_fcfa: number;
  operator: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

/** Un webhook rejoué ne s'applique qu'une fois (contrainte d'unicité). */
export interface WebhookEventsTable {
  id: Generated<string>;
  provider: string;
  external_id: string;
  payload_hash: string;
  signature_valid: boolean;
  outcome: string | null;
  processed_at: Date | null;
  received_at: ColumnType<Date, Date | undefined, never>;
}

/** Compte de reversement : numéro dédié du bénéficiaire, jamais le WhatsApp. */
export interface PayoutAccountsTable {
  id: Generated<string>;
  owner_id: string;
  operator: MobileMoneyOperator;
  msisdn: string;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface PayoutsTable {
  id: Generated<string>;
  payment_id: string;
  beneficiary_id: string;
  kind: 'provider' | 'refund';
  operator: MobileMoneyOperator;
  msisdn: string;
  amount_fcfa: number;
  status: PayoutStatus;
  attempts: Generated<number>;
  failure_reason: string | null;
  provider_reference: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
  sent_at: Date | null;
}

export interface ReconciliationsTable {
  id: Generated<string>;
  day: string;
  operator: string;
  ledger_cash_fcfa: number;
  provider_balance_fcfa: number;
  variance_fcfa: number;
  status: ReconciliationStatus;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface Database {
  payments: PaymentsTable;
  journal_entries: JournalEntriesTable;
  ledger_lines: LedgerLinesTable;
  webhook_events: WebhookEventsTable;
  payout_accounts: PayoutAccountsTable;
  payouts: PayoutsTable;
  reconciliations: ReconciliationsTable;
}

const handle = createDb<Database>({ connectionString: env.DATABASE_URL, schema: 'payments' });

export const db = handle.db;
export const pingDatabase = handle.ping;
