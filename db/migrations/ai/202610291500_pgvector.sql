-- pgvector (F4.3, F4.4). La colonne passe de `jsonb` au type natif `vector(64)`,
-- puis reçoit un index HNSW pour la similarité cosinus.
--
-- Pourquoi maintenant : le stockage JSON venait d'un PostgreSQL Windows sans
-- extension. Le développement (image `pgvector/pgvector:pg17` du compose), la CI
-- et la production disposent tous de `vector` ; garder `jsonb` obligeait le
-- service à charger toutes les lignes et à calculer en mémoire.
--
-- Aucune donnée n'est perdue : `jsonb` et `vector` partagent le même littéral,
-- aux espaces près.

create extension if not exists vector;

alter table embeddings
  alter column "vector" type vector(64)
  using (translate("vector"::text, ' ', '')::vector);

comment on column embeddings."vector" is
  'Vecteur 64 dimensions (pgvector). Écrit et lu en littéral [a,b,c].';

-- HNSW : recherche des plus proches voisins sans parcourir toute la table.
create index if not exists embeddings_vector_cosine_idx
  on embeddings using hnsw ("vector" vector_cosine_ops);
