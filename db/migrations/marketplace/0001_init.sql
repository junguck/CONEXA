-- Schéma marketplace — reconstitué depuis API.md §3.15, schema_extension.sql §2
-- et ARCHITECTURE.md §2. À VALIDER : ADR 0003.
-- Aucun mouvement d'argent : Payments exécute le séquestre, la commande conserve
-- le taux et le montant de commission figés à sa création.

create table if not exists service_categories (
  id serial primary key,
  slug text not null unique,
  name text not null,
  parent_id integer references service_categories (id) on delete set null
);

create table if not exists service_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  category_id integer not null references service_categories (id),
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 20 and 3000),
  pricing text not null default 'fixed' check (pricing in ('fixed', 'hourly')),
  delivery_mode text not null check (delivery_mode in ('online', 'onsite', 'either')),
  location text,
  tags text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'active', 'paused', 'archived')),
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  boost_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paused_reason text
);

create index if not exists listings_search_idx on service_listings (status, category_id, created_at desc);
create index if not exists listings_owner_idx on service_listings (owner_id, status);

create table if not exists listing_packages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references service_listings (id) on delete cascade,
  tier text not null check (tier in ('basic', 'standard', 'premium')),
  name text not null,
  description text,
  price_fcfa integer not null check (price_fcfa >= 500),
  delivery_days smallint not null check (delivery_days between 1 and 60),
  revisions smallint not null default 1 check (revisions between 0 and 10),
  unique (listing_id, tier)
);

create table if not exists listing_availability (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references service_listings (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  booked boolean not null default false,
  unique (listing_id, starts_at),
  check (ends_at > starts_at)
);

create table if not exists listing_favorites (
  user_id uuid not null,
  listing_id uuid not null references service_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists service_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references service_listings (id),
  package_id uuid references listing_packages (id),
  slot_id uuid references listing_availability (id),
  client_id uuid not null,
  provider_id uuid not null,
  requirements text,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'funded', 'in_progress', 'delivered',
                      'completed', 'cancelled', 'disputed')),
  amount_fcfa integer not null check (amount_fcfa >= 0),
  -- Figés à la création : un changement de plan ensuite ne les modifie pas.
  commission_pct numeric(4, 2) not null,
  commission_fcfa integer not null default 0 check (commission_fcfa >= 0),
  revisions_used smallint not null default 0 check (revisions_used >= 0),
  revisions_limit smallint not null default 0 check (revisions_limit >= 0),
  payment_id text,
  delivered_at timestamptz,
  auto_validate_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (client_id <> provider_id)
);

create index if not exists orders_client_idx on service_orders (client_id, status, created_at desc);
create index if not exists orders_provider_idx on service_orders (provider_id, status, created_at desc);

create table if not exists service_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references service_orders (id) on delete cascade,
  type text not null,
  actor_id uuid not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_events_idx on service_order_events (order_id, created_at);

create table if not exists order_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references service_orders (id) on delete cascade,
  author_id uuid not null,
  target_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (order_id, author_id),
  check (author_id <> target_id)
);

create table if not exists order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references service_orders (id) on delete cascade,
  opened_by uuid not null,
  reason text not null,
  evidence_upload_ids uuid[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (order_id)
);

create table if not exists listing_boosts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references service_listings (id) on delete cascade,
  days smallint not null check (days in (3, 7)),
  payment_id text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

insert into service_categories (slug, name) values
  ('design', 'Design et graphisme'),
  ('developpement', 'Développement'),
  ('redaction', 'Rédaction et traduction'),
  ('cours', 'Cours et tutorat'),
  ('video', 'Photo et vidéo'),
  ('evenementiel', 'Événementiel'),
  ('gestion', 'Gestion et comptabilité')
on conflict (slug) do nothing;
