-- Paquet @conexa/messaging — schéma canonique outbox/inbox.
-- Adopté par `services/_template` (T-0005) : chaque service crée ces tables dans
-- SON schéma PostgreSQL (un schéma, un rôle). Ne pas modifier ici sans ADR.
--
-- outbox  : écrite dans la transaction métier, publiée après commit.
-- inbox   : trace des messages déjà traités, pour une consommation idempotente.

CREATE TABLE IF NOT EXISTS outbox (
  id            uuid        PRIMARY KEY,
  envelope      jsonb       NOT NULL,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'published', 'failed')),
  attempts      integer     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at  timestamptz NOT NULL DEFAULT now(),
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- File d'attente : seuls les messages en attente et dus sont balayés.
CREATE INDEX IF NOT EXISTS outbox_pending_idx
  ON outbox (available_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS inbox (
  consumer      text        NOT NULL,
  message_id    uuid        NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, message_id)
);
