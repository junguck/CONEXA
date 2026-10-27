#!/usr/bin/env bash
# Vérifie la pile d'observabilité en fonctionnement (F0.6).
# Prérequis : `pnpm dev:infra` (profils core + observability + storage).
#
#   pnpm test:observability:runtime
#
# Envoie un journal et une trace OTLP au collecteur, puis vérifie :
#   - que le journal arrive dans Loki sans téléphone, matricule ni jeton ;
#   - que la trace arrive dans Tempo et reste interrogeable ;
#   - que Grafana expose les trois sources et Prometheus ses cibles.
set -euo pipefail

compose=(docker compose -f deploy/compose.dev.yaml --profile core --profile storage --profile observability)
for service in otel-collector prometheus loki tempo grafana; do
  if ! "${compose[@]}" ps --status running --services 2>/dev/null | grep -qx "$service"; then
    echo "ERREUR : $service n'est pas démarré (pnpm dev:infra)." >&2
    exit 1
  fi
done

now="$(date +%s)"
nano="${now}000000000"
trace_id="$(openssl rand -hex 16)"
span_id="$(openssl rand -hex 8)"
phone="+237600123456"
matricule="ETU-RUNTIME-1"
token="runtime-secret-token"

echo "journal OTLP -> collecteur (trace $trace_id)"
curl --fail --silent --show-error -X POST http://localhost:4318/v1/logs \
  -H 'Content-Type: application/json' \
  --data @- >/dev/null <<JSON
{"resourceLogs":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"observability-test"}}]},"scopeLogs":[{"logRecords":[{"timeUnixNano":"${nano}","severityText":"INFO","body":{"stringValue":"runtime masking check"},"traceId":"${trace_id}","spanId":"${span_id}","attributes":[{"key":"phone","value":{"stringValue":"${phone}"}},{"key":"matricule","value":{"stringValue":"${matricule}"}},{"key":"token","value":{"stringValue":"${token}"}},{"key":"request_id","value":{"stringValue":"runtime-check"}}]}]}]}]}
JSON

echo "trace OTLP -> collecteur"
curl --fail --silent --show-error -X POST http://localhost:4318/v1/traces \
  -H 'Content-Type: application/json' \
  --data @- >/dev/null <<JSON
{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"observability-test"}}]},"scopeSpans":[{"spans":[{"traceId":"${trace_id}","spanId":"${span_id}","name":"runtime-check","kind":1,"startTimeUnixNano":"${nano}","endTimeUnixNano":"${nano}"}]}]}]}
JSON

echo "attente de l'ingestion..."
sleep 5

start=$((now - 120))
logs="$(curl --silent --get http://localhost:3100/loki/api/v1/query_range \
  --data-urlencode 'query={service_name="observability-test"}' \
  --data-urlencode "start=${start}000000000" \
  --data-urlencode 'limit=50')"

if ! grep -q 'observability-test' <<<"$logs"; then
  echo "ERREUR : le journal de test n'apparaît pas dans Loki." >&2
  echo "$logs" | head -c 500 >&2
  exit 1
fi
for value in "$phone" "$matricule" "$token"; do
  if grep -qF "$value" <<<"$logs"; then
    echo "ERREUR : valeur sensible non masquée dans Loki : $value" >&2
    exit 1
  fi
done
echo "masquage vérifié : téléphone, matricule et jeton absents de Loki"

for attempt in $(seq 1 15); do
  code="$(curl --silent -o /dev/null -w '%{http_code}' "http://localhost:3200/api/traces/${trace_id}")"
  if [[ "$code" == "200" ]]; then
    break
  fi
  sleep 2
done
if [[ "${code:-}" != "200" ]]; then
  echo "ERREUR : la trace ${trace_id} n'est pas lisible dans Tempo (HTTP ${code:-?})." >&2
  exit 1
fi
echo "trace lisible dans Tempo : ${trace_id}"

sources="$(curl --silent --user "${GRAFANA_ADMIN_USER:-conexa}:${GRAFANA_ADMIN_PASSWORD:-conexa_dev}" \
  http://localhost:3000/api/datasources)"
for uid in prometheus loki tempo; do
  if ! grep -q "\"uid\":\"${uid}\"" <<<"$sources"; then
    echo "ERREUR : source Grafana ${uid} absente." >&2
    exit 1
  fi
done
echo "sources Grafana présentes : prometheus, loki, tempo"

targets="$(curl --silent http://localhost:9090/api/v1/targets)"
for job in otel-collector tempo loki; do
  if ! grep -q "\"job\":\"${job}\"" <<<"$targets"; then
    echo "ERREUR : cible Prometheus ${job} absente." >&2
    exit 1
  fi
done
echo "OK : journaux, traces, masquage et sources vérifiés."
