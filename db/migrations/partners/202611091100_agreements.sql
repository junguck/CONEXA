-- Contrats partenaires versionnés (F4.1, T-0056). Un seul contrat actif par
-- organisation : l'index unique partiel le garantit même sous concurrence.
-- La commission d'une réservation est copiée du contrat actif à ce moment-là.

create table if not exists agreements (
  id               uuid        primary key,
  organisation_id  uuid        not null references organisations (id) on delete cascade,
  version          integer     not null check (version >= 1),
  commission_pct   integer     not null check (commission_pct between 0 and 30),
  status           text        not null default 'pending_signature'
                               check (status in ('pending_signature', 'active', 'superseded')),
  created_at       timestamptz not null default now(),
  signed_at        timestamptz,
  signed_by        uuid,
  unique (organisation_id, version),
  -- Un contrat actif est forcément signé.
  constraint agreements_active_signed check (status <> 'active' or signed_at is not null)
);

create unique index if not exists agreements_one_active_idx
  on agreements (organisation_id)
  where status = 'active';

-- Reprise : chaque organisation déjà active reçoit un contrat v1 actif au taux
-- qu'elle portait, pour que les réservations futures lisent un contrat.
insert into agreements (id, organisation_id, version, commission_pct, status, signed_at, signed_by)
select gen_random_uuid(), o.id, 1, o.commission_pct, 'active', now(), o.owner_user_id
from organisations o
where o.status = 'active'
  and not exists (select 1 from agreements a where a.organisation_id = o.id);
