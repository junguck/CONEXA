-- Payments : relève de secours, dédoublonnage des webhooks, reversements et
-- rapprochement quotidien (F3.2 et F3.3). Migration additive : aucune colonne
-- ni table existante n'est supprimée, un paiement déjà en base reste valide.
-- Montants en francs CFA entiers ; aucun numéro de téléphone dans un journal.

-- Relève de secours : quand relire le statut, et quand abandonner proprement.
alter table payments add column if not exists next_check_at timestamptz;
alter table payments add column if not exists checks integer not null default 0;
alter table payments add column if not exists expires_at timestamptz;
alter table payments add column if not exists failure_reason text;
-- Numéro du payeur : nécessaire pour un remboursement par décaissement (il n'y
-- a pas de remboursement natif confirmé). Jamais renvoyé par l'API, jamais
-- journalisé ; masqué s'il doit être affiché.
alter table payments add column if not exists payer_msisdn text;

create index if not exists payments_poll_idx
  on payments (next_check_at)
  where status = 'pending';

-- Le rapprochement est par opérateur : la ligne de caisse porte son opérateur.
alter table ledger_lines add column if not exists operator text;

-- Dédoublonnage : un webhook rejoué ne s'applique qu'une fois. La contrainte
-- d'unicité est la garantie, pas une lecture préalable (course possible).
create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  payload_hash text not null,
  signature_valid boolean not null default false,
  outcome text,
  processed_at timestamptz,
  received_at timestamptz not null default now(),
  constraint webhook_events_unique unique (provider, external_id)
);

-- Compte de reversement : numéro dédié, distinct du WhatsApp, déclaré par le
-- bénéficiaire. Un seul compte actif par bénéficiaire (le dernier enregistré).
create table if not exists payout_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  operator text not null check (operator in ('mtn_momo', 'orange_money')),
  msisdn text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_accounts_one_per_owner unique (owner_id)
);

-- Reversements : un décaissement par paiement et par opérateur du bénéficiaire.
-- `queued` = travail restant (solde insuffisant, compte manquant), jamais une
-- perte d'argent : le paiement reste sous séquestre tant que ce n'est pas `sent`.
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments (id),
  beneficiary_id text not null,
  -- `provider` = reversement au prestataire, `refund` = remboursement au payeur.
  kind text not null default 'provider' check (kind in ('provider', 'refund')),
  operator text not null check (operator in ('mtn_momo', 'orange_money')),
  msisdn text not null,
  amount_fcfa integer not null check (amount_fcfa > 0),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  failure_reason text,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Un seul reversement vivant par paiement : deux libérations concurrentes ne
-- peuvent pas payer deux fois le même prestataire.
create unique index if not exists payouts_one_active_per_payment
  on payouts (payment_id)
  where status in ('queued', 'processing', 'sent');
create index if not exists payouts_queue_idx on payouts (status, created_at);

-- Rapprochement quotidien : grand livre (compte CASH) contre solde de
-- l'agrégateur, par opérateur. Un écart est conservé, jamais corrigé d'office.
create table if not exists reconciliations (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  operator text not null,
  ledger_cash_fcfa integer not null,
  provider_balance_fcfa integer not null,
  variance_fcfa integer not null,
  status text not null check (status in ('ok', 'mismatch')),
  created_at timestamptz not null default now(),
  constraint reconciliations_one_per_day unique (day, operator)
);
