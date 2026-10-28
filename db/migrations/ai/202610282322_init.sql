-- Vecteurs des profils (F4.3, F5.1). `pgvector` n'est pas disponible en local :
-- le vecteur est un tableau JSON, comparé en mémoire par le service. La
-- contrainte d'unicité garantit un seul vecteur par propriétaire.

create table if not exists embeddings (
  id uuid primary key,
  owner_type text not null check (owner_type in ('dating_profile', 'talent_profile')),
  owner_id uuid not null,
  model text not null,
  dimensions integer not null check (dimensions between 16 and 1536),
  vector jsonb not null,
  updated_at timestamptz not null default now(),
  unique (owner_type, owner_id)
);

create index if not exists embeddings_owner_type_idx on embeddings (owner_type, updated_at desc);
