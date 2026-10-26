-- Schéma identity — reconstitué depuis API.md §3.1 et ARCHITECTURE.md §2.
-- À VALIDER : voir docs/decisions/0003-schema-base-reconstitue.md.
-- Aucune donnée d'un autre service ici ; le numéro WhatsApp ne quitte jamais ce schéma.

create table if not exists filieres (
  id serial primary key,
  name text not null unique
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  -- Format imposé : MTN/Orange camerounais, indicatif inclus (STACK.md §3.1).
  whatsapp text not null unique check (whatsapp ~ '^\+237[6-9][0-9]{8}$'),
  full_name text,
  matricule text unique,
  birth_date date,
  gender text check (gender in ('female', 'male', 'other')),
  filiere_id integer references filieres (id),
  study_level smallint check (study_level between 1 and 7),
  photo_upload_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'banned', 'deleted')),
  role text not null default 'student'
    check (role in ('student', 'captain', 'restaurant_staff', 'partner_staff', 'moderator', 'admin', 'service')),
  reliability integer not null default 100 check (reliability between 0 and 100),
  dating_enabled boolean not null default false,
  consent_at timestamptz,
  deleted_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_status_idx on profiles (status, created_at);

create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists otp_lookup_idx on otp_codes (whatsapp, created_at desc);

create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  token_hash text not null unique,
  family_id uuid not null,
  expires_at timestamptz not null,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists refresh_family_idx on refresh_tokens (family_id);

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  target_id uuid not null,
  action text not null check (action in ('approve', 'reject', 'suspend', 'ban', 'reinstate')),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists blocks (
  blocker_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists reliability_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  delta smallint not null,
  reason text not null,
  created_at timestamptz not null default now()
);

insert into filieres (name)
values ('Gestion'), ('Informatique'), ('Droit'), ('Médecine'), ('Génie civil'), ('Lettres')
on conflict (name) do nothing;
