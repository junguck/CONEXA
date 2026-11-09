-- Vecteurs de rencontre reçus du worker IA (`embedding.computed`, F4.3/F4.4).
-- Trois blocs de 64 dimensions, stockés en tableaux de réels : le classement
-- cosinus est calculé dans le service (reproductible, testable sans extension).
-- Les vecteurs sont des données personnelles : jamais journalisés ni exposés.

create table if not exists profile_vectors (
  user_id               uuid primary key references dating_profiles (user_id) on delete cascade,
  questionnaire_version integer          not null check (questionnaire_version >= 1),
  model_version         text             not null,
  values_vec            double precision[] not null check (cardinality(values_vec) = 64),
  personality_vec       double precision[] not null check (cardinality(personality_vec) = 64),
  lifestyle_vec         double precision[] not null check (cardinality(lifestyle_vec) = 64),
  computed_at           timestamptz      not null default now()
);

-- Quarantaine de 60 jours après un refus : on retrouve vite les refus récents.
create index if not exists invites_declined_idx
  on invites (from_user_id, to_user_id, resolved_at)
  where status = 'declined';
