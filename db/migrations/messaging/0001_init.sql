-- Messagerie et notifications. Un fil est rattaché à un objet métier et ne
-- contient jamais de contact externe : le filtre du service refuse les numéros
-- et les liens avant écriture (F2.4).

create table if not exists threads (
  id uuid primary key,
  scope text not null check (scope in ('match', 'order', 'mission', 'date', 'post', 'support')),
  object_id uuid not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  -- Un seul fil par objet métier : le domaine peut appeler sans se poser la question.
  unique (scope, object_id)
);

create table if not exists thread_participants (
  thread_id uuid not null references threads (id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (thread_id, user_id)
);

create index if not exists thread_participants_user_idx on thread_participants (user_id);

create table if not exists messages (
  id uuid primary key,
  thread_id uuid not null references threads (id) on delete cascade,
  sender_id uuid,
  kind text not null check (kind in ('text', 'system', 'card')),
  body text check (char_length(body) between 1 and 2000),
  card_type text,
  payload jsonb,
  created_at timestamptz not null default now(),
  -- Un message texte a un corps, une carte a une charge utile. Un message
  -- système n'a pas d'expéditeur.
  constraint messages_kind_payload check (
    (kind = 'text' and body is not null and card_type is null)
    or (kind = 'card' and card_type is not null and payload is not null and body is null)
    or (kind = 'system' and sender_id is null)
  )
);

create index if not exists messages_thread_idx on messages (thread_id, created_at desc);

create table if not exists notifications (
  id uuid primary key,
  user_id uuid not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on notifications (user_id) where read_at is null;
