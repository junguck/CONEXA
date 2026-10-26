-- Schéma talents — reconstitué depuis API.md §3.10 à §3.12 et ARCHITECTURE.md §2.
-- À VALIDER : voir docs/decisions/0003-schema-base-reconstitue.md.
-- Aucun mouvement d'argent ici : Payments exécute le séquestre, Talents ne stocke
-- qu'un identifiant de paiement et des montants convenus.

create table if not exists skills (
  id serial primary key,
  name text not null,
  category text not null,
  unique (name)
);

create table if not exists user_skills (
  user_id uuid not null,
  skill_id integer not null references skills (id) on delete cascade,
  level smallint not null check (level between 1 and 5),
  proof_url text,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  kind text not null check (kind in ('need', 'project', 'competition', 'service_offer', 'help_request')),
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 20 and 2000),
  budget_fcfa integer check (budget_fcfa >= 0),
  -- Embedding produit par le worker IA (absent en v1, ADR 0003).
  embedding real[],
  status text not null default 'open' check (status in ('open', 'closed', 'deleted')),
  boosted_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_open_idx on posts (status, created_at desc);
create index if not exists posts_author_idx on posts (author_id, created_at desc);

create table if not exists post_skills (
  post_id uuid not null references posts (id) on delete cascade,
  skill_id integer not null references skills (id) on delete cascade,
  primary key (post_id, skill_id)
);

create table if not exists post_applications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  applicant_id uuid not null,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (post_id, applicant_id)
);

create index if not exists applications_post_idx on post_applications (post_id, status);

create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id),
  client_id uuid not null,
  provider_id uuid not null,
  amount_fcfa integer not null check (amount_fcfa > 0),
  commission_fcfa integer not null default 0 check (commission_fcfa >= 0),
  -- Le taux est figé à la proposition : le plan du prestataire ne le change plus.
  commission_pct numeric(4, 2) not null default 8,
  deadline_at timestamptz,
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'funded', 'delivered', 'approved', 'disputed', 'cancelled')),
  payment_id text,
  delivered_note text,
  delivered_uploads uuid[] not null default '{}',
  accepted_at timestamptz,
  funded_at timestamptz,
  delivered_at timestamptz,
  approved_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (client_id <> provider_id)
);

create index if not exists missions_client_idx on missions (client_id, status);
create index if not exists missions_provider_idx on missions (provider_id, status);

create table if not exists mission_events (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  type text not null,
  actor_id uuid not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  author_id uuid not null,
  target_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (mission_id, author_id),
  check (author_id <> target_id)
);

create index if not exists reviews_target_idx on reviews (target_id, created_at desc);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null,
  title text not null check (char_length(title) between 5 and 140),
  description text,
  place text not null,
  starts_at timestamptz not null,
  price_fcfa integer not null default 0 check (price_fcfa >= 0),
  capacity integer check (capacity > 0),
  sponsor_name text,
  status text not null default 'published'
    check (status in ('draft', 'published', 'cancelled', 'finished')),
  created_at timestamptz not null default now()
);

create index if not exists events_start_idx on events (starts_at);

create table if not exists event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null,
  status text not null default 'registered'
    check (status in ('registered', 'checked_in', 'cancelled')),
  payment_id text,
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  unique (event_id, user_id)
);

create table if not exists meetups (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null,
  invitee_id uuid not null,
  post_id uuid references posts (id) on delete set null,
  place text not null,
  starts_at timestamptz not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (organizer_id <> invitee_id)
);

insert into skills (name, category) values
  ('Graphisme', 'Création'),
  ('Développement web', 'Technique'),
  ('Montage vidéo', 'Création'),
  ('Rédaction', 'Communication'),
  ('Traduction', 'Communication'),
  ('Comptabilité', 'Gestion'),
  ('Cours particuliers', 'Pédagogie'),
  ('Photographie', 'Création')
on conflict (name) do nothing;
