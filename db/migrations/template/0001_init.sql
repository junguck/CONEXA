-- Exemple de migration de service.
-- Convention : YYYYMMDDHHMM_description.sql, sens avant uniquement,
-- une migration fusionnée ne se modifie jamais (agents/GIT_WORKFLOW.md §8).
create table if not exists template_items (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(trim(label)) > 0),
  created_at timestamptz not null default now()
);
