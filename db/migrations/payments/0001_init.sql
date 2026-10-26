-- Payments : grand livre à double écriture, paiements et séquestre.
-- Aucun service métier ne manipule d'argent : il détient un `payment_id`.
-- Montants en francs CFA entiers, jamais de décimale.

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  reference_type text not null,
  reference_id uuid not null,
  memo text not null,
  created_at timestamptz not null default now()
);

create index if not exists journal_entries_reference_idx
  on journal_entries (reference_type, reference_id);

create table if not exists ledger_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references journal_entries (id) on delete cascade,
  account text not null,
  direction text not null check (direction in ('debit', 'credit')),
  amount_fcfa integer not null check (amount_fcfa >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ledger_lines_entry_idx on ledger_lines (entry_id);
create index if not exists ledger_lines_account_idx on ledger_lines (account);

create table if not exists payments (
  id uuid primary key,
  object_type text not null check (
    object_type in ('date', 'mission', 'order', 'ticket', 'boost', 'subscription')
  ),
  object_id uuid not null,
  payer_id uuid not null,
  amount_fcfa integer not null check (amount_fcfa > 0),
  commission_fcfa integer not null default 0 check (commission_fcfa >= 0),
  net_fcfa integer not null default 0 check (net_fcfa >= 0),
  provider text not null check (provider in ('mtn_momo', 'orange_money', 'mock')),
  status text not null default 'pending'
    check (status in ('pending', 'escrow', 'released', 'refund_pending', 'refunded', 'failed')),
  external_reference text unique,
  payment_url text,
  idempotency_key text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_at timestamptz,
  refunded_at timestamptz,
  -- Net + commission = montant encaissé, à chaque instant.
  constraint payments_split_consistent check (net_fcfa + commission_fcfa = amount_fcfa)
);

create unique index if not exists payments_idempotency_uq
  on payments (payer_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists payments_object_idx on payments (object_type, object_id);
create index if not exists payments_payer_idx on payments (payer_id, created_at desc);
create index if not exists payments_status_idx on payments (status, created_at);
