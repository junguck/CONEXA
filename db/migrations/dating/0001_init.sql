-- Schéma dating — reconstitué depuis API.md §3.7 à §3.9 et ARCHITECTURE.md §2.
-- À VALIDER : voir docs/decisions/0003-schema-base-reconstitue.md.
-- Le numéro WhatsApp n'est jamais stocké ici : la révélation passe par Identity.
-- `birth_date` et `reliability` sont une projection d'Identity, alimentée par ses
-- événements (ARCHITECTURE.md §2) : Dating ne lit pas le schéma identity.

create table if not exists dating_profiles (
  user_id uuid primary key,
  birth_date date not null,
  gender text check (gender in ('female', 'male', 'other')),
  questionnaire_v integer not null check (questionnaire_v > 0),
  answers jsonb not null default '{}'::jsonb,
  seeking text[] not null default '{}',
  age_min integer not null check (age_min between 18 and 99),
  age_max integer not null check (age_max between 18 and 99),
  status text not null default 'active' check (status in ('active', 'paused')),
  reliability integer not null default 100 check (reliability between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (age_min <= age_max)
);

create table if not exists weekly_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references dating_profiles (user_id) on delete cascade,
  candidate_id uuid not null references dating_profiles (user_id) on delete cascade,
  week_start date not null,
  kind text not null check (kind in ('similar', 'complementary')),
  compat_label text not null default 'Compatible',
  decision text not null default 'none' check (decision in ('none', 'invited', 'passed')),
  created_at timestamptz not null default now(),
  unique (user_id, candidate_id, week_start),
  check (user_id <> candidate_id)
);

create index if not exists weekly_picks_user_idx on weekly_picks (user_id, week_start);

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references dating_profiles (user_id) on delete cascade,
  to_user_id uuid not null references dating_profiles (user_id) on delete cascade,
  pick_id uuid references weekly_picks (id) on delete set null,
  week_start date not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (from_user_id <> to_user_id)
);

-- Une seule invitation en cours entre deux personnes.
create unique index if not exists invites_pending_uq
  on invites (from_user_id, to_user_id)
  where status = 'pending';
create index if not exists invites_to_idx on invites (to_user_id, status);

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  commission_pct numeric(4, 2) not null default 10
);

create table if not exists restaurant_slots (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  starts_at timestamptz not null,
  capacity smallint not null default 1 check (capacity > 0),
  booked smallint not null default 0 check (booked >= 0),
  unique (restaurant_id, starts_at)
);

create table if not exists restaurant_formulas (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name text not null,
  per_person_cap_fcfa integer not null check (per_person_cap_fcfa > 0)
);

create table if not exists dates (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null unique references invites (id) on delete cascade,
  user_a uuid not null,
  user_b uuid not null,
  payer_id uuid not null,
  status text not null default 'negotiating'
    check (status in ('negotiating', 'awaiting_payment', 'confirmed', 'checked_in',
                      'completed', 'cancelled', 'no_show', 'disputed')),
  restaurant_id uuid references restaurants (id),
  slot_id uuid references restaurant_slots (id),
  formula_id uuid references restaurant_formulas (id),
  total_fcfa integer not null default 0 check (total_fcfa >= 0),
  commission_fcfa integer not null default 0 check (commission_fcfa >= 0),
  table_label text,
  -- Code remis à l'accueil : jamais exposé au partenaire.
  checkin_code text not null,
  checked_in_a_at timestamptz,
  checked_in_b_at timestamptz,
  contact_revealed_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_a <> user_b)
);

create index if not exists dates_user_a_idx on dates (user_a, created_at desc);
create index if not exists dates_user_b_idx on dates (user_b, created_at desc);

create table if not exists date_cards (
  id uuid primary key default gen_random_uuid(),
  date_id uuid not null references dates (id) on delete cascade,
  sender_id uuid not null,
  card_type text not null check (card_type in (
    'SLOT_PROPOSE', 'SLOT_ACCEPT', 'SLOT_DECLINE', 'FORMULA_SELECT', 'ORDER_DONE',
    'ARRIVE_EARLY', 'SHY', 'LATE_5', 'LATE_10', 'LATE_15', 'READY',
    'CONFIRM_YES', 'CONFIRM_NO', 'THANKS'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists date_cards_date_idx on date_cards (date_id, created_at);

create table if not exists date_orders (
  id uuid primary key default gen_random_uuid(),
  date_id uuid not null references dates (id) on delete cascade,
  user_id uuid not null,
  menu_item_id text not null,
  quantity smallint not null default 1 check (quantity between 1 and 5),
  unit_price_fcfa integer not null check (unit_price_fcfa >= 0),
  allergy_note text,
  created_at timestamptz not null default now()
);

create table if not exists date_feedback (
  date_id uuid not null references dates (id) on delete cascade,
  user_id uuid not null,
  wants_contact boolean not null,
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (date_id, user_id)
);

create table if not exists date_sos (
  id uuid primary key default gen_random_uuid(),
  date_id uuid not null references dates (id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists date_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount_fcfa integer not null check (amount_fcfa > 0),
  reason text not null,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

insert into restaurants (name) values ('Le Campus'), ('Chez Mama')
on conflict do nothing;
