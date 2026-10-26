import { createDb } from '@conexa/service-kit';
import type { ColumnType, Generated } from 'kysely';

import { env } from './config.js';

export interface SkillsTable {
  id: Generated<number>;
  name: string;
  category: string;
}

export interface UserSkillsTable {
  user_id: string;
  skill_id: number;
  level: number;
  proof_url: string | null;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface PostsTable {
  id: Generated<string>;
  author_id: string;
  kind: 'need' | 'project' | 'competition' | 'service_offer' | 'help_request';
  title: string;
  description: string;
  budget_fcfa: number | null;
  embedding: number[] | null;
  status: Generated<'open' | 'closed' | 'deleted'>;
  boosted_until: Date | null;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface PostSkillsTable {
  post_id: string;
  skill_id: number;
}

export interface PostApplicationsTable {
  id: Generated<string>;
  post_id: string;
  applicant_id: string;
  message: string | null;
  status: Generated<'pending' | 'accepted' | 'declined' | 'withdrawn'>;
  created_at: ColumnType<Date, Date | undefined, never>;
  resolved_at: Date | null;
}

export interface MissionsTable {
  id: Generated<string>;
  post_id: string;
  client_id: string;
  provider_id: string;
  amount_fcfa: number;
  commission_fcfa: Generated<number>;
  commission_pct: Generated<string>;
  deadline_at: Date | null;
  status: Generated<
    'proposed' | 'accepted' | 'funded' | 'delivered' | 'approved' | 'disputed' | 'cancelled'
  >;
  payment_id: string | null;
  delivered_note: string | null;
  delivered_uploads: Generated<string[]>;
  accepted_at: Date | null;
  funded_at: Date | null;
  delivered_at: Date | null;
  approved_at: Date | null;
  cancelled_at: Date | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface MissionEventsTable {
  id: Generated<string>;
  mission_id: string;
  type: string;
  actor_id: string;
  meta: Generated<unknown>;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface ReviewsTable {
  id: Generated<string>;
  mission_id: string;
  author_id: string;
  target_id: string;
  rating: number;
  comment: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface EventsTable {
  id: Generated<string>;
  organizer_id: string;
  title: string;
  description: string | null;
  place: string;
  starts_at: Date;
  price_fcfa: Generated<number>;
  capacity: number | null;
  sponsor_name: string | null;
  status: Generated<'draft' | 'published' | 'cancelled' | 'finished'>;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface EventRegistrationsTable {
  id: Generated<string>;
  event_id: string;
  user_id: string;
  status: Generated<'registered' | 'checked_in' | 'cancelled'>;
  payment_id: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
  checked_in_at: Date | null;
}

export interface MeetupsTable {
  id: Generated<string>;
  organizer_id: string;
  invitee_id: string;
  post_id: string | null;
  place: string;
  starts_at: Date;
  status: Generated<'proposed' | 'accepted' | 'declined' | 'cancelled'>;
  created_at: ColumnType<Date, Date | undefined, never>;
  resolved_at: Date | null;
}

export interface TalentsDb {
  skills: SkillsTable;
  user_skills: UserSkillsTable;
  posts: PostsTable;
  post_skills: PostSkillsTable;
  post_applications: PostApplicationsTable;
  missions: MissionsTable;
  mission_events: MissionEventsTable;
  reviews: ReviewsTable;
  events: EventsTable;
  event_registrations: EventRegistrationsTable;
  meetups: MeetupsTable;
}

const handle = createDb<TalentsDb>({ connectionString: env.DATABASE_URL, schema: 'talents' });

export const db = handle.db;
export const pingDatabase = handle.ping;
