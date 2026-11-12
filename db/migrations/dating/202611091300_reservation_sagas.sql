-- Saga de réservation d'un date (F4.5, T-0058, ARCHITECTURE.md §6.1).
-- L'état de la saga et ses actions à exécuter sont écrits ensemble : un crash
-- entre deux appels (Partners, Payments) ne perd aucune action. Les actions
-- sont reprises tant qu'elles ne sont pas `done`.

create table if not exists reservation_sagas (
  date_id        uuid        primary key references dates (id) on delete cascade,
  state          text        not null
                             check (state in ('holding', 'awaiting_payment', 'confirming',
                                              'confirmed', 'failed', 'cancelled')),
  failure_reason text        check (failure_reason in ('SLOT_LOST', 'PAYMENT_FAILED', 'HOLD_EXPIRED')),
  -- Identifiant opaque envoyé à Partners : une retenue par réservation et par tentative.
  hold_ref       text        not null,
  slot_id        uuid        not null,
  venue_id       uuid        not null,
  payment_id     uuid,
  attempt        integer     not null default 1 check (attempt >= 1),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists reservation_actions (
  id            uuid        primary key,
  date_id       uuid        not null references reservation_sagas (date_id) on delete cascade,
  kind          text        not null
                            check (kind in ('request_hold', 'confirm_hold', 'release_hold',
                                            'confirm_date', 'refund_payment')),
  payload       jsonb       not null default '{}'::jsonb,
  status        text        not null default 'pending'
                            check (status in ('pending', 'running', 'done', 'failed')),
  attempts      integer     not null default 0 check (attempts >= 0),
  available_at  timestamptz not null default now(),
  last_error    text,
  -- Rejouer le même événement ne crée jamais la même action deux fois.
  dedupe_key    text        not null,
  created_at    timestamptz not null default now(),
  unique (date_id, dedupe_key)
);

create index if not exists reservation_actions_due_idx
  on reservation_actions (available_at)
  where status in ('pending', 'running');
