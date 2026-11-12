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
  /** Identifiant opaque du créneau Partners (T-0055) : Dating ne lit jamais `partners.slots`. */
  slot_id: string | null;
  /** Début du créneau recopié à la retenue : nécessaire à la fenêtre d'annulation de 3 h. */
  slot_starts_at: Date | null;
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

export interface ProfileVectorsTable {
  user_id: string;
  questionnaire_version: number;
  model_version: string;
  values_vec: number[];
  personality_vec: number[];
  lifestyle_vec: number[];
  computed_at: ColumnType<Date, Date | undefined, Date>;
}

export interface DatingInboxTable {
  consumer: string;
  message_id: string;
  processed_at: ColumnType<Date, Date | undefined, never>;
}

export interface ReservationSagasTable {
  date_id: string;
  state: 'holding' | 'awaiting_payment' | 'confirming' | 'confirmed' | 'failed' | 'cancelled';
  failure_reason: 'SLOT_LOST' | 'PAYMENT_FAILED' | 'HOLD_EXPIRED' | null;
  hold_ref: string;
  slot_id: string;
  venue_id: string;
  payment_id: string | null;
  attempt: Generated<number>;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface ReservationActionsTable {
  id: string;
  date_id: string;
  kind: 'request_hold' | 'confirm_hold' | 'release_hold' | 'confirm_date' | 'refund_payment';
  payload: Generated<unknown>;
  status: Generated<'pending' | 'running' | 'done' | 'failed'>;
  attempts: Generated<number>;
  available_at: ColumnType<Date, Date, Date>;
  last_error: string | null;
  dedupe_key: string;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface DatingDb {
  dating_profiles: DatingProfilesTable;
  dating_outbox: DatingOutboxTable;
  dating_inbox: DatingInboxTable;
  profile_vectors: ProfileVectorsTable;
  weekly_picks: WeeklyPicksTable;
  invites: InvitesTable;
  restaurants: RestaurantsTable;
  restaurant_formulas: RestaurantFormulasTable;
  dates: DatesTable;
  date_cards: DateCardsTable;
  date_orders: DateOrdersTable;
  date_feedback: DateFeedbackTable;
  date_sos: DateSosTable;
  reservation_sagas: ReservationSagasTable;
  reservation_actions: ReservationActionsTable;
}

const handle = createDb<DatingDb>({ connectionString: env.DATABASE_URL, schema: 'dating' });

export const db = handle.db;
export const pingDatabase = handle.ping;
