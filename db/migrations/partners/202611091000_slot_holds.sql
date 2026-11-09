-- Retenue de créneau de 15 minutes (F4.1, T-0055) + outbox/inbox canoniques
-- (ADR 0007). Une retenue consomme une unité de la capacité du créneau. Elle
-- expire seule : le balayage passe `held` en `expired` après `expires_at`.
-- Aucune donnée personnelle : `hold_ref` est l'identifiant opaque de la
-- réservation (date) côté demandeur.

create table if not exists slot_holds (
  id          uuid        primary key,
  slot_id     uuid        not null references slots (id) on delete cascade,
  hold_ref    text        not null check (length(hold_ref) between 1 and 128),
  status      text        not null default 'held'
                          check (status in ('held', 'confirmed', 'released', 'expired')),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Une seule retenue par réservation : rejouer la demande ne double jamais.
  unique (hold_ref)
);

-- Retenues vivantes d'un créneau : sert au comptage sous verrou et au balayage.
create index if not exists slot_holds_live_idx
  on slot_holds (slot_id)
  where status in ('held', 'confirmed');

create index if not exists slot_holds_expiry_idx
  on slot_holds (expires_at)
  where status = 'held';

create table if not exists partners_outbox (
  id            uuid        primary key,
  envelope      jsonb       not null,
  status        text        not null default 'pending'
                            check (status in ('pending', 'published', 'failed')),
  attempts      integer     not null default 0 check (attempts >= 0),
  available_at  timestamptz not null default now(),
  last_error    text,
  created_at    timestamptz not null default now()
);

create index if not exists partners_outbox_pending_idx
  on partners_outbox (available_at)
  where status = 'pending';

create table if not exists partners_inbox (
  consumer      text        not null,
  message_id    uuid        not null,
  processed_at  timestamptz not null default now(),
  primary key (consumer, message_id)
);
