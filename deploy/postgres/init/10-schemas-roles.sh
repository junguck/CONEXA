#!/bin/bash
# Initialisation PostgreSQL du développement (F0.2).
# Exécuté une seule fois, par l'entrypoint officiel, sur un volume vide.
#
# Un schéma par service, un rôle de connexion par service, droits limités à son
# schéma. Aucun accès croisé : un rôle n'a ni USAGE ni CREATE sur les autres
# schémas. Le mot de passe est celui du développement local uniquement.
set -euo pipefail

: "${POSTGRES_USER:?POSTGRES_USER manquant}"
: "${POSTGRES_DB:?POSTGRES_DB manquant}"

password="${CONEXA_DEV_DB_PASSWORD:-conexa_dev}"
password="${password//\'/\'\'}"
services="identity football dating talents marketplace partners payments billing messaging"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
create extension if not exists vector;
revoke create on schema public from public;
SQL

for service in $services; do
  psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<SQL
do \$\$
begin
  if not exists (select 1 from pg_roles where rolname = 'conexa_${service}') then
    create role conexa_${service} login password '${password}';
  else
    alter role conexa_${service} with login password '${password}';
  end if;
end
\$\$;

create schema if not exists ${service} authorization conexa_${service};
revoke all on schema ${service} from public;
grant usage, create on schema ${service} to conexa_${service};
grant connect on database ${POSTGRES_DB} to conexa_${service};
alter role conexa_${service} set search_path = ${service}, public;
SQL
done

echo "initialisation PostgreSQL terminée : ${services}"
