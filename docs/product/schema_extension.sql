-- =====================================================================
-- Convexa : extension (révision 2) : Abonnements, Services entre
-- étudiants, Partenariats.
--
-- Écrit directement pour la cible microservices : un schéma PostgreSQL
-- par service (billing, marketplace, partners).
-- Règle : AUCUNE clé étrangère entre schémas de services différents.
-- Les identifiants d'utilisateurs, de paiements, de compétitions, etc.
-- sont de simples uuid ; la cohérence passe par les événements.
--
-- Prérequis : schema.sql (types payment_object / thread_kind, tables
-- ledger / chat_threads, fonction public.set_updated_at) et pgvector.
-- Valeurs de seed (prix, quotas) : hypothèses de départ à valider.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists vector;

create schema if not exists billing;
create schema if not exists marketplace;
create schema if not exists partners;

-- ---------------------------------------------------------------------
-- 0. EXTENSION DES OBJETS EXISTANTS
-- À exécuter hors transaction (ALTER TYPE ... ADD VALUE).
-- ---------------------------------------------------------------------
alter type payment_object add value if not exists 'service_order';
alter type payment_object add value if not exists 'subscription';
alter type payment_object add value if not exists 'sponsorship';

alter type thread_kind add value if not exists 'service_order';
alter table chat_threads add column if not exists service_order_id uuid;

alter table ledger drop constraint if exists ledger_kind_check;
alter table ledger add constraint ledger_kind_check check (kind in (
  'charge','commission','restaurant_share','provider_fee','refund','payout','mission_share',
  'service_share','service_commission','subscription_revenue','sponsorship_revenue'));

-- =====================================================================
-- 1. BILLING : plans, abonnements, droits
-- =====================================================================
create type billing.plan_audience as enum ('student','organizer','team','partner');
create type billing.subject_kind  as enum ('user','team','partner');
create type billing.sub_status    as enum ('pending_payment','active','grace','expired','cancelled');

create table billing.outbox (
  id           bigserial primary key,
  event_type   text not null,
  aggregate_id uuid,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  published_at timestamptz
);
create index on billing.outbox (id) where published_at is null;
create table billing.inbox (
  event_id     uuid primary key,
  event_type   text not null,
  processed_at timestamptz not null default now()
);

create table billing.plans (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code ~ '^[A-Z0-9_]{3,40}$'),
  audience     billing.plan_audience not null,
  name         text not null,
  description  text,
  price_fcfa   int  not null check (price_fcfa >= 0),
  period_days  int  not null default 30 check (period_days in (30, 90, 365)),
  grace_days   int  not null default 3 check (grace_days between 0 and 14),
  entitlements jsonb not null default '{}',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Droits du plan gratuit (aucune valeur codée en dur dans les services)
create table billing.free_entitlements (
  subject_kind billing.subject_kind not null,
  key          text not null,
  value        jsonb not null,
  primary key (subject_kind, key)
);

create table billing.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  subject_kind         billing.subject_kind not null,
  subject_id           uuid not null,
  plan_id              uuid not null references billing.plans(id),
  status               billing.sub_status not null default 'pending_payment',
  current_period_start timestamptz,
  current_period_end   timestamptz,
  grace_until          timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at         timestamptz,
  promo_code           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index uq_subscription_live
  on billing.subscriptions (subject_kind, subject_id, plan_id)
  where status in ('pending_payment','active','grace');
create index on billing.subscriptions (status, current_period_end);
create trigger trg_subscriptions_updated before update on billing.subscriptions
  for each row execute function public.set_updated_at();

create table billing.promo_codes (
  code         text primary key check (code ~ '^[A-Z0-9]{4,20}$'),
  plan_id      uuid references billing.plans(id),      -- null = tous les plans
  percent_off  int  not null check (percent_off between 1 and 100),
  max_uses     int  check (max_uses > 0),
  used_count   int  not null default 0,
  valid_until  timestamptz,
  is_active    boolean not null default true
);

create table billing.invoices (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references billing.subscriptions(id),
  period_start    timestamptz,
  period_end      timestamptz,
  amount_fcfa     int not null check (amount_fcfa >= 0),
  discount_fcfa   int not null default 0 check (discount_fcfa >= 0),
  payment_id      uuid unique,                           -- service Payments (pas de FK)
  status          text not null default 'open' check (status in ('open','paid','void')),
  issued_at       timestamptz not null default now(),
  paid_at         timestamptz
);
create index on billing.invoices (subscription_id, issued_at desc);

-- Droits accordés à la main (promotion, partenariat, compensation)
create table billing.entitlement_grants (
  id           uuid primary key default gen_random_uuid(),
  subject_kind billing.subject_kind not null,
  subject_id   uuid not null,
  key          text not null,
  value        jsonb not null,
  reason       text not null,
  granted_by   uuid not null,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index on billing.entitlement_grants (subject_kind, subject_id);

-- Abonnements en cours de validité (période payée ou période de grâce)
create view billing.v_live_subscriptions as
select s.id as subscription_id, s.subject_kind, s.subject_id,
       p.code as plan_code, p.price_fcfa, p.entitlements,
       s.status, s.current_period_end
  from billing.subscriptions s
  join billing.plans p on p.id = s.plan_id
 where (s.status = 'active' and s.current_period_end > now())
    or (s.status = 'grace'  and s.grace_until > now());

-- Droits effectifs : grants > plan payant le plus cher > plan gratuit
create or replace function billing.get_entitlements(p_kind billing.subject_kind, p_subject uuid)
returns jsonb
language sql stable as $$
  select coalesce((
    select jsonb_object_agg(t.key, t.value)
      from (
        select distinct on (e.key) e.key, e.value
          from (
            select g.key, g.value, 1 as prio, 0 as price
              from billing.entitlement_grants g
             where g.subject_kind = p_kind and g.subject_id = p_subject
               and (g.expires_at is null or g.expires_at > now())
            union all
            select kv.key, kv.value, 2 as prio, v.price_fcfa as price
              from billing.v_live_subscriptions v, jsonb_each(v.entitlements) kv
             where v.subject_kind = p_kind and v.subject_id = p_subject
            union all
            select f.key, f.value, 3 as prio, 0 as price
              from billing.free_entitlements f
             where f.subject_kind = p_kind
          ) e
         order by e.key, e.prio, e.price desc
      ) t
  ), '{}'::jsonb)
$$;

-- Démarre un achat ou un renouvellement : crée (ou réutilise) l'abonnement
-- et une facture ouverte. Le paiement est ensuite fait via Payments.
create or replace function billing.start_subscription(
  p_kind billing.subject_kind, p_subject uuid, p_plan_code text, p_promo text default null)
returns table (out_subscription_id uuid, out_invoice_id uuid, out_amount_fcfa int)
language plpgsql security definer set search_path = billing, public as $$
declare
  pl  billing.plans%rowtype;
  pr  billing.promo_codes%rowtype;
  sid uuid; iid uuid; disc int := 0; amt int;
begin
  select * into pl from billing.plans where code = p_plan_code and is_active;
  if pl.id is null then raise exception 'PLAN_NOT_FOUND' using errcode = 'P0001'; end if;

  if (pl.audience in ('student','organizer') and p_kind <> 'user')
     or (pl.audience = 'team' and p_kind <> 'team')
     or (pl.audience = 'partner' and p_kind <> 'partner') then
    raise exception 'PLAN_AUDIENCE_MISMATCH' using errcode = 'P0001';
  end if;

  if p_promo is not null then
    select * into pr from billing.promo_codes
     where code = upper(p_promo) and is_active
       and (plan_id is null or plan_id = pl.id)
       and (valid_until is null or valid_until > now())
       and (max_uses is null or used_count < max_uses);
    if pr.code is null then raise exception 'PROMO_INVALID' using errcode = 'P0001'; end if;
    disc := (pl.price_fcfa * pr.percent_off) / 100;
  end if;
  amt := pl.price_fcfa - disc;

  select id into sid from billing.subscriptions
   where subject_kind = p_kind and subject_id = p_subject and plan_id = pl.id
     and status in ('pending_payment','active','grace')
   limit 1;
  if sid is null then
    insert into billing.subscriptions(subject_kind, subject_id, plan_id, promo_code)
    values (p_kind, p_subject, pl.id, pr.code) returning id into sid;
  end if;

  insert into billing.invoices(subscription_id, amount_fcfa, discount_fcfa)
  values (sid, amt, disc) returning id into iid;

  return query select sid, iid, amt;
end $$;

-- Appelée à la réception de payment.escrowed (idempotente)
create or replace function billing.activate_subscription(p_invoice uuid, p_payment uuid)
returns void
language plpgsql security definer set search_path = billing, public as $$
declare
  inv billing.invoices%rowtype;
  s   billing.subscriptions%rowtype;
  pl  billing.plans%rowtype;
  v_start timestamptz; v_end timestamptz; v_extends boolean;
begin
  select * into inv from billing.invoices where id = p_invoice for update;
  if inv.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if inv.status = 'paid' then return; end if;
  if inv.status = 'void' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;

  select * into s  from billing.subscriptions where id = inv.subscription_id for update;
  select * into pl from billing.plans where id = s.plan_id;

  v_extends := s.status in ('active','grace') and s.current_period_end > now();
  v_start   := case when v_extends then s.current_period_end else now() end;
  v_end     := v_start + make_interval(days => pl.period_days);

  update billing.invoices
     set status = 'paid', paid_at = now(), payment_id = p_payment,
         period_start = v_start, period_end = v_end
   where id = inv.id;

  update billing.subscriptions
     set status = 'active',
         current_period_start = case when v_extends then s.current_period_start else v_start end,
         current_period_end = v_end, grace_until = null, cancel_at_period_end = false
   where id = s.id;

  if inv.discount_fcfa > 0 and s.promo_code is not null then
    update billing.promo_codes set used_count = used_count + 1 where code = s.promo_code;
  end if;

  insert into billing.outbox(event_type, aggregate_id, payload) values
    ('subscription.activated', s.id, jsonb_build_object(
        'subject_kind', s.subject_kind, 'subject_id', s.subject_id,
        'plan_code', pl.code, 'period_end', v_end)),
    ('entitlements.changed', s.id, jsonb_build_object(
        'subject_kind', s.subject_kind, 'subject_id', s.subject_id));
end $$;

-- Cron (toutes les heures) : active -> grâce -> expirée / annulée
create or replace function billing.expire_subscriptions() returns int
language plpgsql security definer set search_path = billing, public as $$
declare n int := 0; r record;
begin
  for r in
    select s.id, s.subject_kind, s.subject_id, s.cancel_at_period_end, p.grace_days
      from billing.subscriptions s
      join billing.plans p on p.id = s.plan_id
     where s.status = 'active' and s.current_period_end <= now()
       for update of s
  loop
    if r.cancel_at_period_end then
      update billing.subscriptions set status = 'cancelled', cancelled_at = now() where id = r.id;
      insert into billing.outbox(event_type, aggregate_id, payload)
      values ('entitlements.changed', r.id,
              jsonb_build_object('subject_kind', r.subject_kind, 'subject_id', r.subject_id));
    elsif r.grace_days = 0 then
      update billing.subscriptions set status = 'expired' where id = r.id;
      insert into billing.outbox(event_type, aggregate_id, payload)
      values ('entitlements.changed', r.id,
              jsonb_build_object('subject_kind', r.subject_kind, 'subject_id', r.subject_id));
    else
      update billing.subscriptions
         set status = 'grace',
             grace_until = current_period_end + make_interval(days => r.grace_days)
       where id = r.id;
    end if;
    n := n + 1;
  end loop;

  for r in
    select id, subject_kind, subject_id from billing.subscriptions
     where status = 'grace' and grace_until <= now()
       for update
  loop
    update billing.subscriptions set status = 'expired' where id = r.id;
    insert into billing.outbox(event_type, aggregate_id, payload)
    values ('entitlements.changed', r.id,
            jsonb_build_object('subject_kind', r.subject_kind, 'subject_id', r.subject_id));
    n := n + 1;
  end loop;

  -- achats jamais payés : abandon après 24 h
  update billing.subscriptions set status = 'expired'
   where status = 'pending_payment' and created_at < now() - interval '24 hours';
  update billing.invoices i set status = 'void'
    from billing.subscriptions s
   where s.id = i.subscription_id and s.status = 'expired' and i.status = 'open';

  return n;
end $$;

-- =====================================================================
-- 2. MARKETPLACE : services entre étudiants
-- =====================================================================
create type marketplace.listing_status as enum
  ('draft','pending_review','active','paused','rejected','archived');
create type marketplace.pricing_kind   as enum ('fixed','hourly','quote');
create type marketplace.delivery_mode  as enum ('remote','in_person','both');
create type marketplace.order_status   as enum
  ('requested','accepted','funded','in_progress','delivered','revision_requested',
   'completed','cancelled','disputed','refunded');

create table marketplace.outbox (
  id           bigserial primary key,
  event_type   text not null,
  aggregate_id uuid,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  published_at timestamptz
);
create index on marketplace.outbox (id) where published_at is null;
create table marketplace.inbox (
  event_id     uuid primary key,
  event_type   text not null,
  processed_at timestamptz not null default now()
);

-- Copie locale des infos publiques (alimentée par user.updated)
create table marketplace.user_cards (
  user_id    uuid primary key,
  first_name text not null,
  photo_url  text,
  filiere    text,
  updated_at timestamptz not null default now()
);

create table marketplace.categories (
  id            serial primary key,
  slug          text not null unique,
  name          text not null,
  parent_id     int references marketplace.categories(id),
  is_restricted boolean not null default false,   -- revue manuelle obligatoire
  is_active     boolean not null default true
);

-- Intégrité académique : termes interdits (liste évolutive + revue manuelle)
create table marketplace.prohibited_terms (
  term   citext primary key,
  reason text not null
);

create table marketplace.service_listings (
  id               uuid primary key default gen_random_uuid(),
  provider_id      uuid not null,
  category_id      int  not null references marketplace.categories(id),
  title            text not null check (char_length(title) between 4 and 120),
  description      text not null check (char_length(description) <= 4000),
  pricing          marketplace.pricing_kind  not null default 'fixed',
  delivery_mode    marketplace.delivery_mode not null default 'remote',
  location         text check (char_length(location) <= 120),
  tags             text[] not null default '{}',
  portfolio_urls   text[] not null default '{}',
  status           marketplace.listing_status not null default 'draft',
  rejection_reason text,
  embedding        vector(1536),
  rating_avg       numeric(3,2) not null default 0,
  rating_count     int not null default 0,
  orders_completed int not null default 0,
  boosted_until    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on marketplace.service_listings using hnsw (embedding vector_cosine_ops);
create index on marketplace.service_listings (status, category_id, created_at desc);
create index on marketplace.service_listings (provider_id);
create trigger trg_listings_updated before update on marketplace.service_listings
  for each row execute function public.set_updated_at();

create or replace function marketplace.check_prohibited() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from marketplace.prohibited_terms t
              where position(lower(t.term::text) in lower(new.title || ' ' || new.description)) > 0) then
    raise exception 'LISTING_PROHIBITED' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_listings_prohibited before insert or update of title, description
  on marketplace.service_listings
  for each row execute function marketplace.check_prohibited();

create table marketplace.service_packages (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references marketplace.service_listings(id) on delete cascade,
  tier          text not null check (tier in ('basic','standard','premium')),
  name          text not null,
  description   text,
  price_fcfa    int  not null check (price_fcfa > 0),
  delivery_days smallint not null check (delivery_days between 1 and 90),
  revisions     smallint not null default 1 check (revisions between 0 and 10),
  unique (listing_id, tier)
);

-- Créneaux réservables (soutien scolaire, prestations sur rendez-vous)
create table marketplace.availability_slots (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references marketplace.service_listings(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  is_booked  boolean not null default false,
  check (ends_at > starts_at),
  unique (listing_id, starts_at)
);

create table marketplace.service_orders (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references marketplace.service_listings(id),
  package_id       uuid references marketplace.service_packages(id),
  slot_id          uuid references marketplace.availability_slots(id),
  client_id        uuid not null,
  provider_id      uuid not null,
  amount_fcfa      int  not null check (amount_fcfa > 0),
  commission_pct   numeric(4,2) not null default 8.00 check (commission_pct between 0 and 30),
  commission_fcfa  int  not null default 0 check (commission_fcfa >= 0),
  status           marketplace.order_status not null default 'requested',
  requirements     text check (char_length(requirements) <= 1000),
  revisions_left   smallint not null default 0,
  deadline_at      timestamptz,
  delivered_at     timestamptz,
  completed_at     timestamptz,
  auto_complete_at timestamptz,
  payment_id       uuid,                              -- service Payments (pas de FK)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (client_id <> provider_id)
);
create index on marketplace.service_orders (client_id, status);
create index on marketplace.service_orders (provider_id, status);
create index on marketplace.service_orders (status, auto_complete_at);
create trigger trg_orders_updated before update on marketplace.service_orders
  for each row execute function public.set_updated_at();

create or replace function marketplace.compute_commission() returns trigger
language plpgsql as $$
begin
  new.commission_fcfa := round(new.amount_fcfa * new.commission_pct / 100)::int;
  return new;
end $$;
create trigger trg_orders_commission before insert on marketplace.service_orders
  for each row execute function marketplace.compute_commission();

create table marketplace.order_deliveries (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references marketplace.service_orders(id) on delete cascade,
  note       text check (char_length(note) <= 1000),
  file_urls  text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table marketplace.order_events (
  id         bigserial primary key,
  order_id   uuid not null references marketplace.service_orders(id) on delete cascade,
  actor_id   uuid,                                    -- null = système
  type       text not null,
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on marketplace.order_events (order_id, id);

create table marketplace.service_reviews (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references marketplace.service_orders(id),
  author_id  uuid not null,
  target_id  uuid not null,
  rating     smallint not null check (rating between 1 and 5),
  comment    text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (order_id, author_id)
);

create table marketplace.disputes (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null unique references marketplace.service_orders(id),
  opened_by        uuid not null,
  reason           text not null check (char_length(reason) <= 1000),
  evidence_urls    text[] not null default '{}',
  status           text not null default 'open' check (status in ('open','resolved')),
  resolution       text check (resolution in ('refund_client','pay_provider','split')),
  split_client_pct smallint check (split_client_pct between 0 and 100),
  resolved_by      uuid,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  check (resolution is distinct from 'split' or split_client_pct is not null)
);

create table marketplace.favorites (
  user_id    uuid not null,
  listing_id uuid not null references marketplace.service_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- Un avis n'est possible que sur une commande terminée, entre ses deux parties
create or replace function marketplace.check_review() returns trigger
language plpgsql as $$
declare o marketplace.service_orders%rowtype;
begin
  select * into o from marketplace.service_orders where id = new.order_id;
  if o.id is null or o.status <> 'completed' then
    raise exception 'ORDER_NOT_COMPLETED' using errcode = 'P0001';
  end if;
  if not ((new.author_id = o.client_id and new.target_id = o.provider_id)
       or (new.author_id = o.provider_id and new.target_id = o.client_id)) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_review_check before insert on marketplace.service_reviews
  for each row execute function marketplace.check_review();

create or replace function marketplace.refresh_listing_rating() returns trigger
language plpgsql as $$
declare lid uuid;
begin
  select listing_id into lid from marketplace.service_orders where id = new.order_id;
  update marketplace.service_listings l
     set rating_count = s.c, rating_avg = s.a
    from (select count(*)::int as c,
                 coalesce(round(avg(r.rating)::numeric, 2), 0) as a
            from marketplace.service_reviews r
            join marketplace.service_orders o on o.id = r.order_id
           where o.listing_id = lid and r.target_id = o.provider_id) s
   where l.id = lid;
  return new;
end $$;
create trigger trg_review_rating after insert on marketplace.service_reviews
  for each row execute function marketplace.refresh_listing_rating();

-- Réserve un créneau (atomique)
create or replace function marketplace.book_slot(p_slot uuid) returns void
language plpgsql security definer set search_path = marketplace, public as $$
begin
  update marketplace.availability_slots set is_booked = true
   where id = p_slot and not is_booked and starts_at > now();
  if not found then raise exception 'SLOT_ALREADY_BOOKED' using errcode = 'P0001'; end if;
end $$;

-- Machine à états d'une commande. p_actor null = système (webhook, cron).
create or replace function marketplace.transition_order(
  p_order uuid, p_actor uuid, p_to marketplace.order_status)
returns marketplace.order_status
language plpgsql security definer set search_path = marketplace, public as $$
declare
  o marketplace.service_orders%rowtype;
  is_client boolean; is_provider boolean; ok boolean;
begin
  select * into o from marketplace.service_orders where id = p_order for update;
  if o.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  is_client   := (p_actor = o.client_id);
  is_provider := (p_actor = o.provider_id);
  if p_actor is not null and not (is_client or is_provider) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  ok := case
    when o.status = 'requested'          and p_to = 'accepted'           then is_provider
    when o.status = 'requested'          and p_to = 'cancelled'          then p_actor is not null
    when o.status = 'accepted'           and p_to = 'funded'             then p_actor is null
    when o.status = 'accepted'           and p_to = 'cancelled'          then p_actor is not null
    when o.status = 'funded'             and p_to = 'in_progress'        then is_provider
    when o.status in ('funded','in_progress') and p_to = 'cancelled'     then is_provider
    when o.status = 'in_progress'        and p_to = 'delivered'          then is_provider
    when o.status = 'delivered'          and p_to = 'completed'          then is_client or p_actor is null
    when o.status = 'delivered'          and p_to = 'revision_requested' then is_client and o.revisions_left > 0
    when o.status = 'revision_requested' and p_to = 'delivered'          then is_provider
    when o.status in ('funded','in_progress','delivered','revision_requested')
                                         and p_to = 'disputed'           then p_actor is not null
    else false end;
  if not ok then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;

  update marketplace.service_orders
     set status = p_to,
         delivered_at = case when p_to = 'delivered' then now() else delivered_at end,
         completed_at = case when p_to = 'completed' then now() else completed_at end,
         auto_complete_at = case
            when p_to = 'delivered' then now() + interval '72 hours'
            when p_to in ('completed','cancelled','disputed') then null
            else auto_complete_at end,
         revisions_left = case when p_to = 'revision_requested'
                               then revisions_left - 1 else revisions_left end
   where id = o.id;

  if p_to = 'cancelled' and o.slot_id is not null then
    update marketplace.availability_slots set is_booked = false where id = o.slot_id;
  end if;
  if p_to = 'completed' then
    update marketplace.service_listings set orders_completed = orders_completed + 1
     where id = o.listing_id;
  end if;

  insert into marketplace.order_events(order_id, actor_id, type, meta)
  values (o.id, p_actor, 'status.' || p_to::text,
          jsonb_build_object('from', o.status::text, 'to', p_to::text));

  insert into marketplace.outbox(event_type, aggregate_id, payload)
  values ('service_order.' || p_to::text, o.id, jsonb_build_object(
            'order_id', o.id, 'from', o.status::text, 'to', p_to::text,
            'client_id', o.client_id, 'provider_id', o.provider_id,
            'amount_fcfa', o.amount_fcfa, 'commission_fcfa', o.commission_fcfa,
            'payment_id', o.payment_id));

  return p_to;
end $$;

-- Cron (toutes les 15 min) : validation automatique 72 h après livraison
create or replace function marketplace.auto_complete_orders() returns int
language plpgsql security definer set search_path = marketplace, public as $$
declare r record; n int := 0;
begin
  for r in select id from marketplace.service_orders
            where status = 'delivered' and auto_complete_at <= now()
              for update skip locked
  loop
    perform marketplace.transition_order(r.id, null, 'completed');
    n := n + 1;
  end loop;
  return n;
end $$;

-- =====================================================================
-- 3. PARTNERS : partenaires, sponsoring, offres, bannières
-- =====================================================================
create type partners.org_kind    as enum
  ('restaurant','merchant','sponsor','telecom','media','institution');
create type partners.org_status  as enum
  ('applied','under_review','active','suspended','rejected','ended');
create type partners.deal_status as enum
  ('proposed','negotiating','accepted','paid','active','completed','cancelled');

create table partners.outbox (
  id           bigserial primary key,
  event_type   text not null,
  aggregate_id uuid,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  published_at timestamptz
);
create index on partners.outbox (id) where published_at is null;
create table partners.inbox (
  event_id     uuid primary key,
  event_type   text not null,
  processed_at timestamptz not null default now()
);

create table partners.organizations (
  id               uuid primary key default gen_random_uuid(),
  kind             partners.org_kind not null,
  name             text not null check (char_length(name) between 2 and 120),
  legal_name       text,
  description      text check (char_length(description) <= 1000),
  logo_url         text,
  website          text,
  contact_name     text,
  contact_whatsapp text check (contact_whatsapp ~ '^\+[0-9]{8,15}$'),
  contact_email    citext,
  commission_pct   numeric(4,2) not null default 0 check (commission_pct between 0 and 50),
  status           partners.org_status not null default 'applied',
  rejection_reason text,
  approved_by      uuid,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index uq_org_live_name on partners.organizations (lower(name))
  where status in ('applied','under_review','active');
create index on partners.organizations (kind, status);
create trigger trg_orgs_updated before update on partners.organizations
  for each row execute function public.set_updated_at();

create table partners.staff (
  organization_id uuid not null references partners.organizations(id) on delete cascade,
  user_id         uuid not null,
  role            text not null default 'staff' check (role in ('owner','manager','staff')),
  added_at        timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index on partners.staff (user_id);

-- Contrat versionné (commission, exclusivité, délai de reversement… dans terms)
create table partners.agreements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references partners.organizations(id) on delete cascade,
  version         int  not null check (version > 0),
  terms           jsonb not null default '{}',
  document_url    text,
  starts_on       date not null,
  ends_on         date,
  status          text not null default 'draft'
                  check (status in ('draft','sent','active','expired','terminated')),
  signed_by       uuid,
  signed_at       timestamptz,
  created_by      uuid not null,
  created_at      timestamptz not null default now(),
  unique (organization_id, version),
  check (ends_on is null or ends_on > starts_on)
);
create unique index uq_one_active_agreement on partners.agreements (organization_id)
  where status = 'active';

-- Lieux physiques (restaurant de dates, boutique…)
create table partners.venues (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references partners.organizations(id) on delete cascade,
  name            text not null,
  address         text,
  latitude        double precision check (latitude between -90 and 90),
  longitude       double precision check (longitude between -180 and 180),
  is_dating_venue boolean not null default false,
  is_active       boolean not null default true
);
create index on partners.venues (organization_id);

-- Sponsoring ----------------------------------------------------------
create table partners.sponsorship_packages (
  id           uuid primary key default gen_random_uuid(),
  tier         text not null check (tier in ('bronze','silver','gold','title')),
  name         text not null,
  price_fcfa   int  not null check (price_fcfa >= 0),
  deliverables jsonb not null default '[]',
  is_active    boolean not null default true
);

create table partners.sponsorship_deals (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references partners.organizations(id),
  package_id         uuid references partners.sponsorship_packages(id),
  target_type        text not null check (target_type in ('competition','event','team','app_section')),
  target_id          uuid,                              -- service propriétaire de la cible
  amount_fcfa        int  not null default 0 check (amount_fcfa >= 0),
  in_kind_value_fcfa int  not null default 0 check (in_kind_value_fcfa >= 0),
  status             partners.deal_status not null default 'proposed',
  proposed_by        text not null check (proposed_by in ('partner','admin')),
  starts_on          date not null,
  ends_on            date not null,
  deliverables       jsonb not null default '[]',
  payment_id         uuid,                              -- service Payments (pas de FK)
  created_by         uuid not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (target_type = 'app_section' or target_id is not null)
);
create index on partners.sponsorship_deals (organization_id, status);
create index on partners.sponsorship_deals (target_type, target_id) where status = 'active';
create trigger trg_deals_updated before update on partners.sponsorship_deals
  for each row execute function public.set_updated_at();

create table partners.sponsorship_assets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references partners.organizations(id) on delete cascade,
  deal_id         uuid references partners.sponsorship_deals(id) on delete set null,
  kind            text not null check (kind in ('logo','banner','video')),
  url             text not null,
  approved        boolean not null default false,
  approved_by     uuid,
  rejected_reason text,
  created_at      timestamptz not null default now()
);

create table partners.ad_placements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references partners.organizations(id) on delete cascade,
  deal_id         uuid references partners.sponsorship_deals(id) on delete cascade,
  asset_id        uuid not null references partners.sponsorship_assets(id),
  slot            text not null check (slot in
                    ('home_banner','ranking_banner','match_card','event_page','offers_page')),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  max_impressions int check (max_impressions > 0),
  is_active       boolean not null default true,
  check (ends_at > starts_at)
);
create index on partners.ad_placements (slot, starts_at, ends_at) where is_active;

create table partners.ad_stats_daily (
  placement_id uuid not null references partners.ad_placements(id) on delete cascade,
  day          date not null,
  impressions  int  not null default 0,
  clicks       int  not null default 0,
  primary key (placement_id, day)
);

-- Bannières diffusables maintenant (visuel approuvé, partenaire actif,
-- contrat actif s'il y en a un, plafond d'impressions non atteint)
create view partners.v_servable_placements as
select pl.id, pl.slot, pl.starts_at, pl.ends_at, pl.organization_id, pl.deal_id,
       a.url as asset_url, a.kind as asset_kind, o.name as partner_name
  from partners.ad_placements pl
  join partners.organizations o on o.id = pl.organization_id and o.status = 'active'
  join partners.sponsorship_assets a on a.id = pl.asset_id and a.approved
  left join partners.sponsorship_deals d on d.id = pl.deal_id
 where pl.is_active
   and now() between pl.starts_at and pl.ends_at
   and (pl.deal_id is null or d.status = 'active')
   and (pl.max_impressions is null
        or pl.max_impressions > coalesce((select sum(s.impressions)
                                            from partners.ad_stats_daily s
                                           where s.placement_id = pl.id), 0));

create or replace function partners.track_ad(p_placement uuid, p_kind text) returns void
language plpgsql as $$
begin
  if p_kind not in ('impression','click') then
    raise exception 'VALIDATION_ERROR' using errcode = 'P0001';
  end if;
  insert into partners.ad_stats_daily(placement_id, day, impressions, clicks)
  values (p_placement, current_date, (p_kind = 'impression')::int, (p_kind = 'click')::int)
  on conflict (placement_id, day) do update
    set impressions = partners.ad_stats_daily.impressions + (p_kind = 'impression')::int,
        clicks      = partners.ad_stats_daily.clicks      + (p_kind = 'click')::int;
end $$;

-- Appelée à la réception de payment.escrowed (idempotente)
create or replace function partners.mark_deal_paid(p_deal uuid, p_payment uuid) returns void
language plpgsql security definer set search_path = partners, public as $$
declare d partners.sponsorship_deals%rowtype;
begin
  select * into d from partners.sponsorship_deals where id = p_deal for update;
  if d.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if d.status in ('paid','active','completed') then return; end if;
  if d.status <> 'accepted' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;

  if d.starts_on <= current_date then
    update partners.sponsorship_deals set status = 'active', payment_id = p_payment where id = d.id;
  else
    update partners.sponsorship_deals set status = 'paid', payment_id = p_payment where id = d.id;
  end if;

  insert into partners.outbox(event_type, aggregate_id, payload)
  values ('sponsorship.paid', d.id, jsonb_build_object(
            'deal_id', d.id, 'organization_id', d.organization_id,
            'target_type', d.target_type, 'target_id', d.target_id));
end $$;

-- Cron (quotidien 00:05) : démarre et clôt les sponsorings
create or replace function partners.activate_due_deals() returns int
language plpgsql security definer set search_path = partners, public as $$
declare r record; n int := 0;
begin
  for r in select id, organization_id, target_type, target_id
             from partners.sponsorship_deals
            where status = 'paid' and starts_on <= current_date for update
  loop
    update partners.sponsorship_deals set status = 'active' where id = r.id;
    insert into partners.outbox(event_type, aggregate_id, payload)
    values ('sponsorship.activated', r.id, jsonb_build_object(
              'deal_id', r.id, 'organization_id', r.organization_id,
              'target_type', r.target_type, 'target_id', r.target_id));
    n := n + 1;
  end loop;
  update partners.sponsorship_deals set status = 'completed'
   where status = 'active' and ends_on < current_date;
  return n;
end $$;

-- Offres étudiantes et bons ------------------------------------------
create table partners.offers (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references partners.organizations(id) on delete cascade,
  title                text not null check (char_length(title) between 4 and 120),
  description          text check (char_length(description) <= 1000),
  kind                 text not null check (kind in ('percent','fixed','freebie')),
  value                int  check (value > 0),
  conditions           text check (char_length(conditions) <= 500),
  requires_entitlement text,                 -- ex. 'STUDENT_PLUS' (vérifié via Billing par l'API)
  stock                int  check (stock > 0),
  claimed_count        int  not null default 0,
  per_user_limit       int  not null default 1 check (per_user_limit between 1 and 10),
  valid_from           timestamptz not null default now(),
  valid_until          timestamptz,
  status               text not null default 'draft'
                       check (status in ('draft','pending_review','active','paused','ended','rejected')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (kind = 'freebie' or value is not null),
  check (kind <> 'percent' or value <= 100),
  check (valid_until is null or valid_until > valid_from)
);
create index on partners.offers (organization_id, status);
create index on partners.offers (status, valid_until);
create trigger trg_offers_updated before update on partners.offers
  for each row execute function public.set_updated_at();

create table partners.vouchers (
  id          uuid primary key default gen_random_uuid(),
  offer_id    uuid not null references partners.offers(id),
  user_id     uuid not null,
  code        text not null unique,
  status      text not null default 'issued'
              check (status in ('issued','redeemed','expired','cancelled')),
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid
);
create index on partners.vouchers (user_id, status);
create index on partners.vouchers (offer_id, status);

-- L'étudiant réclame une offre. p_has_entitlement est fourni par l'API
-- après interrogation de Billing (pas d'accès inter-schéma ici).
create or replace function partners.claim_offer(
  p_offer uuid, p_user uuid, p_has_entitlement boolean default false)
returns text
language plpgsql security definer set search_path = partners, public as $$
declare o partners.offers%rowtype; mine int; v_code text;
begin
  select * into o from partners.offers where id = p_offer for update;
  if o.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  if o.status <> 'active' or now() < o.valid_from
     or (o.valid_until is not null and now() > o.valid_until) then
    raise exception 'OFFER_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  if o.requires_entitlement is not null and not p_has_entitlement then
    raise exception 'ENTITLEMENT_REQUIRED' using errcode = 'P0001';
  end if;
  if o.stock is not null and o.claimed_count >= o.stock then
    raise exception 'OFFER_SOLD_OUT' using errcode = 'P0001';
  end if;

  select count(*) into mine from partners.vouchers
   where offer_id = o.id and user_id = p_user and status in ('issued','redeemed');
  if mine >= o.per_user_limit then
    raise exception 'OFFER_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  v_code := upper(encode(gen_random_bytes(5), 'hex'));
  insert into partners.vouchers(offer_id, user_id, code, expires_at)
  values (o.id, p_user, v_code,
          least(coalesce(o.valid_until, now() + interval '30 days'), now() + interval '30 days'));
  update partners.offers set claimed_count = claimed_count + 1 where id = o.id;
  return v_code;
end $$;

-- Le personnel du partenaire consomme un bon (une seule fois)
create or replace function partners.redeem_voucher(p_code text, p_staff uuid)
returns table (out_offer_title text, out_user_id uuid)
language plpgsql security definer set search_path = partners, public as $$
declare v partners.vouchers%rowtype; o partners.offers%rowtype;
begin
  select * into v from partners.vouchers where code = upper(p_code) for update;
  if v.id is null then raise exception 'VOUCHER_INVALID' using errcode = 'P0001'; end if;
  select * into o from partners.offers where id = v.offer_id;

  if not exists (select 1 from partners.staff s
                  where s.organization_id = o.organization_id and s.user_id = p_staff) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v.status = 'redeemed' then raise exception 'VOUCHER_ALREADY_USED' using errcode = 'P0001'; end if;
  if v.status <> 'issued' or v.expires_at <= now() then
    raise exception 'VOUCHER_EXPIRED' using errcode = 'P0001';
  end if;

  update partners.vouchers
     set status = 'redeemed', redeemed_at = now(), redeemed_by = p_staff
   where id = v.id;
  insert into partners.outbox(event_type, aggregate_id, payload)
  values ('voucher.redeemed', v.id, jsonb_build_object(
            'voucher_id', v.id, 'offer_id', o.id, 'user_id', v.user_id));

  return query select o.title, v.user_id;
end $$;

-- Cron (toutes les heures) : offres terminées, bons périmés
create or replace function partners.expire_offers_and_vouchers() returns void
language plpgsql security definer set search_path = partners, public as $$
begin
  update partners.offers set status = 'ended'
   where status = 'active' and valid_until is not null and valid_until <= now();
  update partners.vouchers set status = 'expired'
   where status = 'issued' and expires_at <= now();
end $$;

-- =====================================================================
-- 4. SEED (hypothèses de départ, à valider)
-- =====================================================================
insert into billing.free_entitlements(subject_kind, key, value) values
  ('user',    'service_commission_pct', '8'),
  ('user',    'max_active_listings',    '3'),
  ('user',    'events_per_month',       '2'),
  ('user',    'ticket_commission_pct',  '8'),
  ('user',    'boosts_per_month',       '0'),
  ('partner', 'max_active_offers',      '1'),
  ('partner', 'ad_placements',          '0')
on conflict do nothing;

insert into billing.plans(code, audience, name, description, price_fcfa, entitlements) values
  ('STUDENT_PLUS',  'student',   'Étudiant Plus',  'Plus d''offres et commission réduite', 1500,
   '{"max_active_listings":10,"service_commission_pct":5,"boosts_per_month":1,"badge":"plus"}'),
  ('ORGANIZER_PRO', 'organizer', 'Organisateur Pro', 'Événements, billetterie et statistiques', 5000,
   '{"events_per_month":20,"ticket_commission_pct":5,"event_analytics":true,"attendee_export":true,"boosts_per_month":2,"badge":"organizer"}'),
  ('TEAM_PRO',      'team',      'Équipe Pro',     'Page d''équipe et statistiques (aucun effet sur le classement)', 2000,
   '{"team_page":true,"advanced_stats":true,"custom_kit":true}'),
  ('PARTNER_BASIC', 'partner',   'Partenaire Basic', 'Offres étudiantes et une bannière', 10000,
   '{"max_active_offers":3,"ad_placements":1,"partner_analytics":true}'),
  ('PARTNER_PLUS',  'partner',   'Partenaire Plus', 'Plus d''offres, bannières et vitrine sponsor', 25000,
   '{"max_active_offers":20,"ad_placements":5,"partner_analytics":true,"sponsor_showcase":true}')
on conflict do nothing;

insert into marketplace.categories(slug, name, is_restricted) values
  ('design',        'Design et graphisme',        false),
  ('web-dev',       'Développement web et mobile', false),
  ('video-photo',   'Vidéo et photo',             false),
  ('writing',       'Rédaction et traduction',    true),
  ('tutoring',      'Soutien scolaire (cours)',   true),
  ('music-events',  'Musique et animation',       false),
  ('tech-repair',   'Dépannage informatique',     false)
on conflict do nothing;

insert into marketplace.prohibited_terms(term, reason) values
  ('devoir à ta place',      'fraude académique'),
  ('devoir à votre place',   'fraude académique'),
  ('examen à ta place',      'fraude académique'),
  ('examen à votre place',   'fraude académique'),
  ('tricher',                'fraude académique'),
  ('plagiat',                'fraude académique')
on conflict do nothing;

insert into partners.sponsorship_packages(tier, name, price_fcfa, deliverables) values
  ('bronze', 'Bronze', 25000,  '["logo sur la page de la compétition"]'),
  ('silver', 'Argent', 75000,  '["logo","bannière pendant la compétition"]'),
  ('gold',   'Or',     200000, '["logo","bannière","mention dans les notifications de match"]'),
  ('title',  'Titre',  500000, '["nom de la compétition","logo","bannière d''accueil","remise du trophée"]')
on conflict do nothing;
