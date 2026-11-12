-- Décisions du 12/11/2026 :
--  * `dates.slot_id` désigne désormais un créneau Partners (T-0055). Dating ne
--    duplique plus les créneaux du restaurant : il recopie seulement l'heure de
--    début à la retenue, indispensable à la fenêtre d'annulation de 3 h.
--  * Décision 16C : aucun crédit restaurant, aucun solde. Le trou n°4 de la
--    roadmap est supprimé, pas seulement désactivé.

-- 1. Le créneau et le lieu appartiennent à Partners : plus de clé étrangère locale.
--    La table `restaurants` reste une copie de travail pour les formules et le
--    menu (remplacés par le menu Partners dans une tâche dédiée).
alter table dates drop constraint if exists dates_slot_id_fkey;
alter table dates drop constraint if exists dates_restaurant_id_fkey;

alter table dates add column if not exists slot_starts_at timestamptz;

-- Reprise des dates existants : l'heure de début était portée par le créneau local.
update dates d
   set slot_starts_at = s.starts_at
  from restaurant_slots s
 where d.slot_id = s.id
   and d.slot_starts_at is null;

comment on column dates.slot_id is
  'Identifiant opaque du créneau Partners (T-0055). Dating ne lit jamais le schéma partners.';
comment on column dates.slot_starts_at is
  'Début du créneau recopié à la retenue : seule source de la fenêtre d''annulation de 3 h.';
comment on column dates.restaurant_id is
  'Identifiant d''organisation (venue) Partners, jamais une table locale.';

drop index if exists restaurant_slots_venue_idx;
drop table if exists restaurant_slots;

-- 2. Décision 16C : suppression du crédit restaurant.
drop table if exists date_credits;
