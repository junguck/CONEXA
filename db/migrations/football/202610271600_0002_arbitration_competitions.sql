-- Migration 0002 (T-0030 à T-0034) : arbitrage admin, fenêtres de clôture,
-- compétitions et outbox d'événements. Additive uniquement : 0001 n'est jamais modifiée.

-- --- arbitrage et fenêtres de clôture ---------------------------------------

-- Vrai quand une seule déclaration a été acceptée faute de seconde (H+24).
alter table matches add column if not exists provisional boolean not null default false;
-- Renseigné une fois la fenêtre de contestation de 48 h écoulée.
alter table matches add column if not exists contest_closed_at timestamptz;
-- Renseigné une fois le vote MVP de 24 h dépouillé.
alter table matches add column if not exists mvp_closed_at timestamptz;

create index if not exists matches_closing_idx on matches (status, starts_at);
create index if not exists matches_mvp_idx on matches (status, finalized_at)
  where mvp_closed_at is null;

-- Journal des arbitrages : qui a tranché, quoi, pourquoi, quand.
create table if not exists match_adjudications (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  admin_id uuid not null,
  decision text not null check (decision in ('validated', 'void')),
  score_a smallint check (score_a >= 0),
  score_b smallint check (score_b >= 0),
  reason text not null check (char_length(reason) between 10 and 500),
  evidence_upload_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  check (decision = 'void' or (score_a is not null and score_b is not null))
);

create index if not exists match_adjudications_match_idx
  on match_adjudications (match_id, created_at desc);

-- --- compétitions -----------------------------------------------------------

create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 64),
  format text not null check (format in ('league', 'groups', 'knockout')),
  status text not null default 'draft' check (status in ('draft', 'active', 'finished')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create unique index if not exists competitions_name_uq on competitions (lower(name));

create table if not exists competition_teams (
  competition_id uuid not null references competitions (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  group_no smallint check (group_no > 0),
  joined_at timestamptz not null default now(),
  primary key (competition_id, team_id)
);

create index if not exists competition_teams_group_idx
  on competition_teams (competition_id, group_no);

-- Une place de tableau (poule ou phase finale) : un match, un vainqueur, une seule fois.
create table if not exists competition_slots (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id) on delete cascade,
  stage text not null
    check (stage in ('group', 'round_of_16', 'quarter_final', 'semi_final', 'final')),
  position smallint not null check (position > 0),
  match_id uuid references matches (id) on delete set null,
  home_team_id uuid references teams (id) on delete set null,
  away_team_id uuid references teams (id) on delete set null,
  winner_team_id uuid references teams (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (competition_id, stage, position)
);

-- Un match ne remplit qu'une place de tableau.
create unique index if not exists competition_slots_match_uq
  on competition_slots (match_id)
  where match_id is not null;

alter table matches add column if not exists competition_id uuid
  references competitions (id) on delete set null;

create index if not exists matches_competition_idx
  on matches (competition_id, status);

-- --- outbox d'événements (T-0034) ------------------------------------------

create table if not exists event_outbox (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  version smallint not null default 1 check (version > 0),
  occurred_at timestamptz not null default now(),
  payload jsonb not null,
  published_at timestamptz,
  attempts smallint not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists event_outbox_pending_idx
  on event_outbox (created_at)
  where published_at is null;
