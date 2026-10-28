import { createDb } from '@conexa/service-kit';
import type { ColumnType, Generated } from 'kysely';

import { env } from './config.js';

export interface DatingProfilesTable {
  user_id: string;
  birth_date: ColumnType<Date, Date | string, Date | string>;
  gender: 'female' | 'male' | 'other' | null;
  questionnaire_v: number;
  answers: Generated<unknown>;
  seeking: string[];
  age_min: number;
  age_max: number;
  status: Generated<'active' | 'paused'>;
  reliability: Generated<number>;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface WeeklyPicksTable {
  id: Generated<string>;
  user_id: string;
  candidate_id: string;
  week_start: ColumnType<string, string, never>;
  kind: 'similar' | 'complementary';
  compat_label: Generated<string>;
  decision: Generated<'none' | 'invited' | 'passed'>;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface InvitesTable {
  id: Generated<string>;
  from_user_id: string;
  to_user_id: string;
  pick_id: string | null;
  week_start: ColumnType<string, string, never>;
  status: Generated<'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired'>;
  created_at: ColumnType<Date, Date | undefined, never>;
  resolved_at: Date | null;
}

export interface RestaurantsTable {
  id: Generated<string>;
  name: string;
  active: Generated<boolean>;
  commission_pct: Generated<string>;
}

export interface RestaurantSlotsTable {
  id: Generated<string>;
  restaurant_id: string;
  starts_at: Date;
  capacity: Generated<number>;
  booked: Generated<number>;
}

export interface RestaurantFormulasTable {
  id: Generated<string>;
  restaurant_id: string;
  name: string;
  per_person_cap_fcfa: number;
}

export interface DatesTable {
  id: Generated<string>;
  invite_id: string;
  user_a: string;
  user_b: string;
  payer_id: string;
  status: Generated<
    | 'negotiating'
    | 'awaiting_payment'
    | 'confirmed'
    | 'checked_in'
    | 'completed'
    | 'cancelled'
    | 'no_show'
    | 'disputed'
  >;
  restaurant_id: string | null;
  slot_id: string | null;
  formula_id: string | null;
  total_fcfa: Generated<number>;
  commission_fcfa: Generated<number>;
  table_label: string | null;
  checkin_code: string;
  checked_in_a_at: Date | null;
  checked_in_b_at: Date | null;
  contact_revealed_at: Date | null;
  cancelled_at: Date | null;
  completed_at: Date | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface DateCardsTable {
  id: Generated<string>;
  date_id: string;
  sender_id: string;
  card_type:
    | 'SLOT_PROPOSE'
    | 'SLOT_ACCEPT'
    | 'SLOT_DECLINE'
    | 'FORMULA_SELECT'
    | 'ORDER_DONE'
    | 'ARRIVE_EARLY'
    | 'SHY'
    | 'LATE_5'
    | 'LATE_10'
    | 'LATE_15'
    | 'READY'
    | 'CONFIRM_YES'
    | 'CONFIRM_NO'
    | 'THANKS';
  payload: Generated<unknown>;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface DateOrdersTable {
  id: Generated<string>;
  date_id: string;
  user_id: string;
  menu_item_id: string;
  quantity: Generated<number>;
  unit_price_fcfa: number;
  allergy_note: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface DateFeedbackTable {
  date_id: string;
  user_id: string;
  wants_contact: boolean;
  criteria: Generated<unknown>;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface DateSosTable {
  id: Generated<string>;
  date_id: string;
  user_id: string;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface DateCreditsTable {
  id: Generated<string>;
  user_id: string;
  amount_fcfa: number;
  reason: string;
  expires_at: Date | null;
  used_at: Date | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface DatingOutboxTable {
  id: string;
  /** Enveloppe complète (`@conexa/events`) : rejeu = même id. */
  envelope: unknown;
  status: Generated<'pending' | 'published' | 'failed'>;
  attempts: Generated<number>;
  available_at: ColumnType<Date, Date, Date>;
  last_error: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface DatingDb {
  dating_profiles: DatingProfilesTable;
  dating_outbox: DatingOutboxTable;
  weekly_picks: WeeklyPicksTable;
  invites: InvitesTable;
  restaurants: RestaurantsTable;
  restaurant_slots: RestaurantSlotsTable;
  restaurant_formulas: RestaurantFormulasTable;
  dates: DatesTable;
  date_cards: DateCardsTable;
  date_orders: DateOrdersTable;
  date_feedback: DateFeedbackTable;
  date_sos: DateSosTable;
  date_credits: DateCreditsTable;
}

const handle = createDb<DatingDb>({ connectionString: env.DATABASE_URL, schema: 'dating' });

export const db = handle.db;
export const pingDatabase = handle.ping;
