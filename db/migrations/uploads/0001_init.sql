-- Uploads : emplacement déclaré, contenu écrit une seule fois, pièce jointe
-- optionnelle à un objet métier (profil, équipe, offre, mission, litige…).
-- Le schéma ne stocke aucun contenu : seulement les métadonnées et la clé de
-- stockage (pilote local en développement, S3-compatible en production).

create table uploads (
  id uuid primary key,
  owner_id uuid not null,
  purpose text not null check (
    purpose in (
      'profile_photo',
      'team_logo',
      'listing_photo',
      'portfolio',
      'mission_evidence',
      'match_evidence',
      'date_receipt',
      'event_banner'
    )
  ),
  content_type text not null,
  byte_size integer not null check (byte_size >= 0),
  status text not null default 'pending' check (status in ('pending', 'ready', 'deleted')),
  storage_key text,
  checksum text,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  deleted_at timestamptz,
  -- Un fichier prêt a toujours une clé de stockage et une empreinte.
  constraint uploads_ready_has_storage check (
    status <> 'ready' or (storage_key is not null and checksum is not null)
  )
);

create index uploads_owner_created_idx on uploads (owner_id, created_at desc);
create index uploads_pending_idx on uploads (created_at) where status = 'pending';

create table upload_attachments (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null unique references uploads (id) on delete cascade,
  object_type text not null check (
    object_type in (
      'profile',
      'team',
      'listing',
      'portfolio',
      'mission',
      'match',
      'date',
      'event',
      'report'
    )
  ),
  object_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index upload_attachments_object_idx on upload_attachments (object_type, object_id);
create index upload_attachments_creator_idx on upload_attachments (created_by);
