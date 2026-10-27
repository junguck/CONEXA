import type { MessageKind, ThreadScope } from '@conexa/contracts';
import { createDb } from '@conexa/service-kit';
import type { ColumnType } from 'kysely';

import { env } from './config.js';

export interface ThreadsTable {
  id: string;
  scope: ThreadScope;
  object_id: string;
  created_at: ColumnType<Date, Date | undefined, never>;
  last_message_at: Date | null;
}

export interface ThreadParticipantsTable {
  thread_id: string;
  user_id: string;
  joined_at: ColumnType<Date, Date | undefined, never>;
  last_read_at: Date | null;
}

export interface MessagesTable {
  id: string;
  thread_id: string;
  sender_id: string | null;
  kind: MessageKind;
  body: string | null;
  card_type: string | null;
  payload: Record<string, unknown> | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface NotificationsTable {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: Date | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface Database {
  threads: ThreadsTable;
  thread_participants: ThreadParticipantsTable;
  messages: MessagesTable;
  notifications: NotificationsTable;
}

const handle = createDb<Database>({ connectionString: env.DATABASE_URL, schema: 'messaging' });

export const db = handle.db;
export const pingDatabase = handle.ping;
