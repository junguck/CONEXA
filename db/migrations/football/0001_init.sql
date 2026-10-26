-- Schéma football — reconstitué depuis API.md §3.2 à §3.5 et ARCHITECTURE.md §2.
-- À VALIDER : voir docs/decisions/0003-schema-base-reconstitue.md.
-- Aucune donnée d'identité ici : les `user_id` référencent identity.profiles sans clé
-- étrangère inter-schémas (un service ne lit pas le schéma d'un autre, ARCHITECTURE.md §1).

create table if not exists fields (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 48),
  filiere_id integer not null,
  logo_upload_id uuid,
  -- `unranked` tant que l'équipe n'a pas joué RANKED_MIN_MATCHES matchs validés.
  level text not null default 'unranked'
    check (level in ('unranked', 'bronze', 'silver', 'gold', 'platinum')),
  elo integer not null default 1000 check (elo >= 100),
  recruiting boolean not null default true,
  status text not null default 'active' check (status in ('active', 'dissolved')),
  captain_id uuid not null,
  matches_played integer not null default 0 check (matches_played >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dissolved_at timestamptz
);

-- Un nom d'équipe est unique au sein d'une filière, parmi les équipes actives.
create unique index if not exists teams_name_filiere_uq
  on teams (lower(name), filiere_id)
  where status = 'active';
create index if not exists teams_ranking_idx on teams (elo desc) where status = 'active';

create table if not exists team_members (
  team_id uuid not null references teams (id) on delete cascade,
  user_id uuid not null,
  role text not null default 'player' check (role in ('captain', 'player')),
  position text check (position in ('goalkeeper', 'defender', 'midfielder', 'forward')),
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  matches integer not null default 0 check (matches >= 0),
  mvp_count integer not null default 0 check (mvp_count >= 0),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  -- Gel de 7 jours appliqué au départ (API.md §3.2).
  cooldown_until timestamptz,
  primary key (team_id, user_id)
);

-- Un joueur n'appartient qu'à une seule équipe active à la fois.
create unique index if not exists team_members_one_active_uq
  on team_members (user_id)
  where left_at is null;

create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  user_id uuid not null,
  -- `invite` : le capitaine invite ; `request` : le joueur demande à rejoindre.
  direction text not null check (direction in ('invite', 'request')),
  created_by uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  resolved_at timestamptz
);

create unique index if not exists team_invites_pending_uq
  on team_invites (team_id, user_id, direction)
  where status = 'pending';
create index if not exists team_invites_user_idx on team_invites (user_id, status);

create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  from_team_id uuid not null references teams (id) on delete cascade,
  to_team_id uuid not null references teams (id) on delete cascade,
  field_id uuid not null references fields (id),
  proposed_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'countered', 'cancelled', 'expired')),
  parent_id uuid references challenges (id) on delete set null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (from_team_id <> to_team_id)
);

create index if not exists challenges_received_idx on challenges (to_team_id, status, created_at desc);
create index if not exists challenges_sent_idx on challenges (from_team_id, status, created_at desc);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges (id) on delete set null,
  home_team_id uuid not null references teams (id),
  away_team_id uuid not null references teams (id),
  field_id uuid not null references fields (id),
  starts_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'awaiting_reports', 'validated', 'disputed', 'cancelled', 'forfeited')),
  score_a smallint check (score_a >= 0),
  score_b smallint check (score_b >= 0),
  mvp_user_id uuid,
  elo_home_before integer,
  elo_away_before integer,
  elo_home_after integer,
  elo_away_after integer,
  finalized_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create index if not exists matches_starts_idx on matches (starts_at desc);
create index if not exists matches_home_idx on matches (home_team_id, starts_at desc);
create index if not exists matches_away_idx on matches (away_team_id, starts_at desc);

-- Un créneau de terrain n'accueille qu'un match (verrou par contrainte, pas par code).
create table if not exists field_bookings (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  match_id uuid references matches (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (field_id, starts_at)
);

create table if not exists match_reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  team_id uuid not null references teams (id),
  submitted_by uuid not null,
  score_a smallint not null check (score_a >= 0),
  score_b smallint not null check (score_b >= 0),
  events jsonb not null default '[]'::jsonb,
  evidence_upload_ids uuid[] not null default '{}',
  submitted_at timestamptz not null default now(),
  unique (match_id, team_id)
);

create table if not exists match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  team_id uuid not null references teams (id),
  player_id uuid not null,
  type text not null check (type in ('goal', 'assist', 'own_goal', 'yellow_card', 'red_card')),
  minute smallint not null check (minute between 1 and 130),
  related_player_id uuid
);

create index if not exists match_events_match_idx on match_events (match_id);

create table if not exists match_lineups (
  match_id uuid not null references matches (id) on delete cascade,
  team_id uuid not null references teams (id),
  player_id uuid not null,
  primary key (match_id, player_id)
);

create table if not exists match_contests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  team_id uuid not null references teams (id),
  reason text not null,
  evidence_upload_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (match_id, team_id)
);

create table if not exists mvp_votes (
  match_id uuid not null references matches (id) on delete cascade,
  voter_id uuid not null,
  player_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (match_id, voter_id)
);

-- Journal Elo : une ligne par équipe et par match validé, jamais réécrite.
create table if not exists elo_history (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  match_id uuid not null references matches (id) on delete cascade,
  elo_before integer not null,
  elo_after integer not null,
  at timestamptz not null default now(),
  unique (team_id, match_id)
);

create table if not exists player_badges (
  user_id uuid not null,
  code text not null,
  awarded_at timestamptz not null default now(),
  unique (user_id, code)
);

insert into fields (name, location)
values
  ('Terrain du campus', 'Campus principal'),
  ('Terrain municipal', 'Quartier administratif')
on conflict do nothing;
