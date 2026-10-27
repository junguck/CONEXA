-- Notifications push web. Un abonnement est un navigateur ; l'endpoint est
-- unique, car le réenregistrement du même navigateur doit mettre à jour la
-- ligne au lieu d'en créer une seconde (F1.5).

create table if not exists push_subscriptions (
  id uuid primary key,
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  platform text not null default 'web' check (platform in ('web', 'android', 'ios')),
  failure_count integer not null default 0 check (failure_count >= 0),
  last_success_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- Journal d'envoi : une ligne par tentative, succès ou échec, jamais la charge
-- utile (elle peut contenir un message privé).
create table if not exists push_deliveries (
  id uuid primary key,
  subscription_id uuid not null,
  user_id uuid not null,
  type text not null,
  channel text not null check (channel in ('console', 'web_push')),
  status text not null check (status in ('sent', 'failed')),
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists push_deliveries_user_idx on push_deliveries (user_id, created_at desc);
