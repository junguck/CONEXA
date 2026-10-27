-- Billing : plans, abonnements et droits effectifs. Aucun taux n'est codé en
-- dur dans les services métier : ils lisent `commission_pct` ici.
-- Les prix sont en francs CFA entiers, par période.

create table if not exists plans (
  code text primary key,
  name text not null,
  audience text not null check (audience in ('student', 'organizer', 'restaurant', 'partner')),
  price_fcfa integer not null check (price_fcfa >= 0),
  period text not null default 'monthly' check (period in ('monthly', 'yearly')),
  commission_pct integer not null default 8 check (commission_pct between 0 and 30),
  max_active_listings integer not null default 3 check (max_active_listings >= 0),
  picks_per_week integer not null default 3 check (picks_per_week >= 0),
  boost_discount_pct integer not null default 0 check (boost_discount_pct between 0 and 100),
  event_commission_pct integer not null default 5 check (event_commission_pct between 0 and 30),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Un seul plan gratuit par audience : le repli est toujours déterminé.
create unique index if not exists plans_one_default_per_audience
  on plans (audience)
  where is_default;

create table if not exists subscriptions (
  id uuid primary key,
  user_id uuid not null,
  plan_code text not null references plans (code),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'past_due', 'cancelled')),
  payment_id uuid,
  started_at timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un abonnement actif a toujours un début de période.
  constraint subscriptions_active_has_start check (status <> 'active' or started_at is not null)
);

-- Un seul abonnement actif par compte.
create unique index if not exists subscriptions_one_active
  on subscriptions (user_id)
  where status = 'active';
create index if not exists subscriptions_user_idx on subscriptions (user_id, created_at desc);

insert into plans (
  code, name, audience, price_fcfa, period,
  commission_pct, max_active_listings, picks_per_week, boost_discount_pct,
  event_commission_pct, is_default
) values
  ('student_free', 'Étudiant', 'student', 0, 'monthly', 8, 3, 3, 0, 5, true),
  ('student_plus', 'Étudiant Plus', 'student', 2000, 'monthly', 6, 10, 6, 20, 5, false),
  ('organizer_pro', 'Organisateur Pro', 'organizer', 5000, 'monthly', 5, 20, 6, 30, 3, false),
  ('restaurant_free', 'Restaurant', 'restaurant', 0, 'monthly', 8, 3, 0, 0, 5, true),
  ('restaurant_standard', 'Restaurant Standard', 'restaurant', 10000, 'monthly', 6, 10, 0, 10, 4, false),
  ('partner_free', 'Partenaire', 'partner', 0, 'monthly', 8, 3, 0, 0, 5, true),
  ('partner_basic', 'Partenaire Basic', 'partner', 15000, 'monthly', 5, 10, 0, 20, 3, false)
on conflict (code) do nothing;
