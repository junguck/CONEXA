import type { AccountStatus, Role } from '@conexa/contracts';
import { createDb } from '@conexa/service-kit';
import type { ColumnType, Generated } from 'kysely';

import { env } from './config.js';

export interface ProfilesTable {
  id: Generated<string>;
  whatsapp: string;
  full_name: string | null;
  matricule: string | null;
  birth_date: string | null;
  gender: 'female' | 'male' | 'other' | null;
  filiere_id: number | null;
  study_level: number | null;
  photo_upload_id: string | null;
  /** `deleted` = refusé/anonymisé, hors des statuts exposés par l'API. */
  status: AccountStatus | 'deleted';
  role: Role;
  reliability: Generated<number>;
  dating_enabled: Generated<boolean>;
  consent_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface OtpCodesTable {
  id: Generated<string>;
  whatsapp: string;
  code_hash: string;
  expires_at: Date;
  attempts: Generated<number>;
  consumed_at: Date | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface RefreshTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  family_id: string;
  expires_at: Date;
  rotated_at: Date | null;
  revoked_at: Date | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface FilieresTable {
  id: Generated<number>;
  name: string;
}

export interface ReportsTable {
  id: Generated<string>;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: Generated<string>;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface AdminActionsTable {
  id: Generated<string>;
  admin_id: string;
  target_id: string;
  action: string;
  reason: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface ReliabilityEventsTable {
  id: Generated<string>;
  user_id: string;
  delta: number;
  reason: string;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface Database {
  profiles: ProfilesTable;
  otp_codes: OtpCodesTable;
  refresh_tokens: RefreshTokensTable;
  filieres: FilieresTable;
  reports: ReportsTable;
  admin_actions: AdminActionsTable;
  reliability_events: ReliabilityEventsTable;
}

const handle = createDb<Database>({ connectionString: env.DATABASE_URL, schema: 'identity' });

export const db = handle.db;
export const pingDatabase = handle.ping;
