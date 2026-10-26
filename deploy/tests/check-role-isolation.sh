#!/usr/bin/env bash
# Vérifie qu'un rôle de service ne peut pas lire le schéma d'un autre service.
# Prérequis : `pnpm dev:infra` (conteneur conexa-postgres sain).
#
#   pnpm test:db:isolation
set -euo pipefail

compose=(docker compose -f deploy/compose.dev.yaml --profile core --profile storage --profile observability)

# Mode local (vérification sans Docker) : CONEXA_TEST_PGHOST=127.0.0.1 PGPORT=...
if [[ -n "${CONEXA_TEST_PGHOST:-}" ]]; then
  database="${CONEXA_TEST_DB:-conexa}"
  psql_as() {
    local role="$1" sql="$2"
    psql "--host=${CONEXA_TEST_PGHOST}" "--port=${CONEXA_TEST_PGPORT:-5432}" \
      --username "$role" --dbname "$database" --set ON_ERROR_STOP=1 --no-psqlrc -c "$sql"
  }
else
  if ! "${compose[@]}" ps --status running --services 2>/dev/null | grep -qx postgres; then
    echo "ERREUR : le service postgres n'est pas démarré (pnpm dev:infra)." >&2
    exit 1
  fi
  database="$("${compose[@]}" exec -T postgres printenv POSTGRES_DB | tr -d '\r')"
  psql_as() {
    local role="$1" sql="$2"
    "${compose[@]}" exec -T postgres \
      psql --username "$role" --dbname "$database" --set ON_ERROR_STOP=1 --no-psqlrc -c "$sql"
  }
fi

cleanup() {
  psql_as conexa_football 'drop table if exists football.isolation_probe' >/dev/null 2>&1 || true
}
trap cleanup EXIT

psql_as conexa_football \
  'create table if not exists football.isolation_probe (id integer primary key); insert into football.isolation_probe values (1)' >/dev/null
echo "probe : football.isolation_probe créée par conexa_football"

if ! psql_as conexa_football 'select count(*) from football.isolation_probe' >/dev/null; then
  echo "ERREUR : football ne peut pas lire son propre schéma." >&2
  exit 1
fi

blocked=0
for service in identity dating talents marketplace partners payments billing messaging; do
  if psql_as "conexa_${service}" 'select count(*) from football.isolation_probe' >/dev/null 2>&1; then
    echo "ERREUR : conexa_${service} lit le schéma football." >&2
    exit 1
  fi
  if psql_as "conexa_${service}" 'create table football.forbidden_probe (id integer)' >/dev/null 2>&1; then
    echo "ERREUR : conexa_${service} écrit dans le schéma football." >&2
    exit 1
  fi
  blocked=$((blocked + 1))
done

echo "OK : ${blocked} rôles ne peuvent ni lire ni écrire le schéma football."
