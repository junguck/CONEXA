import { createDb } from '@conexa/service-kit';
import type { ColumnType } from 'kysely';

import { env } from './config.js';

export interface PushSubscriptionsTable {
  id: string;
  user_id: string;
  /** Unicité par endpoint : réenregistrer le même navigateur met à jour la ligne. */
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string;
  failure_count: number;
  last_success_at: Date | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface PushDeliveriesTable {
  id: string;
  subscription_id: string;
  user_id: string;
  type: string;
  channel: string;
  status: 'sent' | 'failed';
  error_code: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface Database {
  push_subscriptions: PushSubscriptionsTable;
  push_deliveries: PushDeliveriesTable;
}

const handle = createDb<Database>({ connectionString: env.DATABASE_URL, schema: 'notifications' });

export const db = handle.db;
export const pingDatabase = handle.ping;
