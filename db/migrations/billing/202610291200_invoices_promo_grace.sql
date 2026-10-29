-- Factures, codes promo, période de grâce et expiration des abonnements
-- (T-0026). Montants entiers en FCFA, jamais négatifs ; la remise ne peut pas
 rendre un total inférieur à 0. La grâce (3 jours) garde les droits, ensuite
-- l'abonnement passe à `expired` et ses droits retombent au plan gratuit.

-- Le numéro de facture est séquentiel et lisible, attribué par la base.
create sequence if not exists invoice_number_seq;

create table if not exists invoices (
  id              uuid        primary key,
  subscription_id uuid        not null,
  user_id         uuid        not null,
  number          text        not null unique default ('INV-' || nextval('invoice_number_seq')),
  plan_code       text        not null,
  base_fcfa       integer     not null check (base_fcfa >= 0),
  discount_fcfa   integer     not null default 0 check (discount_fcfa >= 0),
  total_fcfa      integer     not null check (total_fcfa >= 0),
  promo_code      text,
  status          text        not null default 'open'
                              check (status in ('open', 'paid', 'void')),
  payment_id      uuid,
  issued_at       timestamptz not null default now(),
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists invoices_user_idx on invoices (user_id, issued_at desc);
create index if not exists invoices_subscription_idx on invoices (subscription_id);

-- Codes promo : plafond de redemptions, fenêtre de validité, activation.
create table if not exists promo_codes (
  code             text        not null primary key,
  discount_pct     integer     not null check (discount_pct between 1 and 100),
  max_redemptions  integer,
  redeemed_count   integer     not null default 0 check (redeemed_count >= 0),
  starts_at        timestamptz,
  ends_at          timestamptz,
  active           boolean     not null default true,
  created_at       timestamptz not null default now(),
  constraint promo_codes_window check (starts_at is null or ends_at is null or starts_at < ends_at)
);

-- Grâce après un renouvellement manqué, et résiliation différée à la fin de
-- la période. `expired` rejoint la machine d'états des abonnements.
alter table subscriptions
  add column if not exists grace_until timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

alter table subscriptions
  drop constraint if exists subscriptions_status_check;
alter table subscriptions
  add constraint subscriptions_status_check
    check (status in ('pending', 'active', 'past_due', 'expired', 'cancelled'));

-- Balayage quotidien : abonnements actifs échus, puis grâce échue.
create index if not exists subscriptions_period_due_idx
  on subscriptions (status, current_period_end)
  where status in ('active', 'past_due');
