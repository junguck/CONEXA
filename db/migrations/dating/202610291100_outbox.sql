-- Outbox et inbox du service dating (schéma canonique @conexa/messaging,
-- ADR 0007). L'événement est écrit dans la même transaction que la donnée
-- métier : un rollback ne produit rien. Le relais publie par lot et fait
-- progresser `attempts` / `available_at` sans jamais perdre un message.
-- Contrairement à la piste abandonnée (enveloppe éclatée en colonnes), la
-- colonne `envelope` porte l'enveloppe complète : le rejeu réutilise l'id de
-- la ligne comme clé d'idempotence côté consommateur.

create table if not exists dating_outbox (
  id            uuid        primary key,
  envelope      jsonb       not null,
  status        text        not null default 'pending'
                            check (status in ('pending', 'published', 'failed')),
  attempts      integer     not null default 0 check (attempts >= 0),
  available_at  timestamptz not null default now(),
  last_error    text,
  created_at    timestamptz not null default now()
);

-- File d'attente : seuls les messages en attente et dus sont balayés.
create index if not exists dating_outbox_pending_idx
  on dating_outbox (available_at)
  where status = 'pending';

-- Consommation idempotente, alignée pour les futurs consommateurs du domaine
-- (saga de réservation, crédits restaurant) : même couple (consumer, message_id).
create table if not exists dating_inbox (
  consumer      text        not null,
  message_id    uuid        not null,
  processed_at  timestamptz not null default now(),
  primary key (consumer, message_id)
);
