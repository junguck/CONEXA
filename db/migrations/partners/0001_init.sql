-- Partenaires (F4.1, F5.7). Une organisation possède des lieux ; un lieu porte
-- menu, formules et créneaux ; une offre émise par une organisation est
-- retirée une seule fois par utilisateur.

create table if not exists organisations (
  id uuid primary key,
  owner_user_id uuid not null,
  name text not null,
  kind text not null check (kind in ('restaurant', 'venue', 'shop', 'service')),
  city text not null,
  contact_whatsapp text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  commission_pct integer not null default 10 check (commission_pct between 0 and 30),
  created_at timestamptz not null default now()
);

create index if not exists organisations_owner_idx on organisations (owner_user_id);

create table if not exists venues (
  id uuid primary key,
  organisation_id uuid not null references organisations (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('restaurant', 'terrain', 'salle', 'bar')),
  -- Ville normalisée (sans accents, minuscules) : la recherche ne dépend pas de la casse.
  city text not null,
  address text not null,
  capacity integer not null check (capacity > 0),
  price_per_hour_fcfa integer check (price_per_hour_fcfa >= 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now()
);

create index if not exists venues_city_kind_idx on venues (city, kind) where status = 'active';

create table if not exists menu_items (
  id uuid primary key,
  venue_id uuid not null references venues (id) on delete cascade,
  name text not null,
  price_fcfa integer not null check (price_fcfa >= 0),
  category text not null default 'autre' check (category in ('plat', 'boisson', 'dessert', 'autre')),
  available boolean not null default true
);

create index if not exists menu_items_venue_idx on menu_items (venue_id, category);

create table if not exists formulas (
  id uuid primary key,
  venue_id uuid not null references venues (id) on delete cascade,
  name text not null,
  price_fcfa integer not null check (price_fcfa >= 0),
  min_people integer not null default 1 check (min_people > 0),
  includes text[] not null default '{}'
);

create table if not exists slots (
  id uuid primary key,
  venue_id uuid not null references venues (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 1 check (capacity > 0),
  price_fcfa integer check (price_fcfa >= 0),
  status text not null default 'open' check (status in ('open', 'booked', 'closed')),
  -- Un créneau finit après avoir commencé et dure au plus 8 h.
  constraint slots_window check (
    ends_at > starts_at and ends_at <= starts_at + interval '8 hours'
  )
);

create index if not exists slots_venue_idx on slots (venue_id, starts_at) where status = 'open';

create table if not exists offers (
  id uuid primary key,
  organisation_id uuid not null references organisations (id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('percent', 'fixed')),
  value integer not null check (value > 0),
  city text not null,
  quota integer check (quota > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  -- Le compteur ne dépasse jamais le quota : la base garde la règle.
  constraint offers_quota check (quota is null or redeemed_count <= quota)
);

create index if not exists offers_city_idx on offers (city, created_at desc);

create table if not exists offer_redemptions (
  id uuid primary key,
  offer_id uuid not null references offers (id) on delete cascade,
  user_id uuid not null,
  code text not null,
  redeemed_at timestamptz not null default now(),
  -- Une offre par utilisateur : le doublon est refusé par la base.
  unique (offer_id, user_id),
  unique (code)
);
