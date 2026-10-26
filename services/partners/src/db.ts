import { createDb } from '@conexa/service-kit';
import type { ColumnType } from 'kysely';

import { env } from './config.js';

export interface OrganisationsTable {
  id: string;
  owner_user_id: string;
  name: string;
  kind: string;
  city: string;
  contact_whatsapp: string;
  status: 'pending' | 'active' | 'suspended';
  commission_pct: number;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface VenuesTable {
  id: string;
  organisation_id: string;
  name: string;
  kind: string;
  city: string;
  address: string;
  capacity: number;
  price_per_hour_fcfa: number | null;
  status: 'pending' | 'active' | 'suspended';
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface MenuItemsTable {
  id: string;
  venue_id: string;
  name: string;
  price_fcfa: number;
  category: string;
  available: boolean;
}

export interface FormulasTable {
  id: string;
  venue_id: string;
  name: string;
  price_fcfa: number;
  min_people: number;
  includes: string[];
}

export interface SlotsTable {
  id: string;
  venue_id: string;
  starts_at: Date;
  ends_at: Date;
  capacity: number;
  price_fcfa: number | null;
  status: 'open' | 'booked' | 'closed';
}

export interface OffersTable {
  id: string;
  organisation_id: string;
  title: string;
  kind: 'percent' | 'fixed';
  value: number;
  city: string;
  quota: number | null;
  redeemed_count: number;
  valid_until: Date | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface RedemptionsTable {
  id: string;
  offer_id: string;
  user_id: string;
  code: string;
  redeemed_at: ColumnType<Date, Date | undefined, never>;
}

export interface Database {
  organisations: OrganisationsTable;
  venues: VenuesTable;
  menu_items: MenuItemsTable;
  formulas: FormulasTable;
  slots: SlotsTable;
  offers: OffersTable;
  offer_redemptions: RedemptionsTable;
}

const handle = createDb<Database>({ connectionString: env.DATABASE_URL, schema: 'partners' });

export const db = handle.db;
export const pingDatabase = handle.ping;
