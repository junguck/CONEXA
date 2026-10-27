import type { PaymentObjectType, PaymentProvider, PaymentStatus } from '@conexa/contracts';
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
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface Database {
  payments: PaymentsTable;
  journal_entries: JournalEntriesTable;
  ledger_lines: LedgerLinesTable;
}

const handle = createDb<Database>({ connectionString: env.DATABASE_URL, schema: 'payments' });

export const db = handle.db;
export const pingDatabase = handle.ping;
