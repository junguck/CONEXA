import type { UploadObjectType, UploadPurpose, UploadStatus } from '@conexa/contracts';
import { createDb } from '@conexa/service-kit';
import type { ColumnType, Generated } from 'kysely';

import { env } from './config.js';

export interface UploadsTable {
  id: Generated<string>;
  owner_id: string;
  purpose: UploadPurpose;
  content_type: string;
  byte_size: number;
  status: UploadStatus;
  storage_key: string | null;
  checksum: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
  ready_at: Date | null;
  deleted_at: Date | null;
}

export interface UploadAttachmentsTable {
  id: Generated<string>;
  upload_id: string;
  object_type: UploadObjectType;
  object_id: string;
  created_by: string;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface Database {
  uploads: UploadsTable;
  upload_attachments: UploadAttachmentsTable;
}

const handle = createDb<Database>({ connectionString: env.DATABASE_URL, schema: 'uploads' });

export const db = handle.db;
export const pingDatabase = handle.ping;
