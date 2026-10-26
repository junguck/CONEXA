#!/usr/bin/env python3
"""Vérifie la politique de masquage du collecteur (F0.6).

Le collecteur supprime les attributs sensibles avant export vers Tempo, Loki
et Prometheus. Ce test lit la configuration, vérifie que chaque contexte
(journaux, spans, points de métrique) couvre la liste obligatoire, puis
applique la politique à un enregistrement d'exemple.

Le test de bout en bout (collecteur réel + Loki) est
`deploy/tests/check-observability-runtime.sh`.
"""
from __future__ import annotations

import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CONFIG = ROOT / "deploy/observability/otel-collector.yaml"
REQUIRED = {
    "phone",
    "phone_number",
    "whatsapp",
    "msisdn",
    "matricule",
    "momo",
    "otp",
    "password",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
}
CONTEXTS = {"log_statements": "journaux", "trace_statements": "spans", "metric_statements": "métriques"}
DELETE = re.compile(r'delete_key\(attributes,\s*"([^"]+)"\)')


def keys_for(statements: list) -> set[str]:
    keys: set[str] = set()
    for group in statements or []:
        for statement in group.get("statements") or []:
            keys.update(DELETE.findall(statement))
    return keys


def main() -> int:
    config = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    transform = (config.get("processors") or {}).get("transform") or {}
    errors: list[str] = []

    for section, label in CONTEXTS.items():
        keys = keys_for(transform.get(section))
        missing = REQUIRED - keys
        if missing:
            errors.append(f"{label} : attributs non masqués {', '.join(sorted(missing))}")

    if set((config.get("service") or {}).get("pipelines") or {}) != {"traces", "logs", "metrics"}:
        errors.append("les trois pipelines traces/logs/metrics doivent exister")

    sample = {
        "phone": "+237600000000",
        "whatsapp": "+237600000001",
        "matricule": "ETU-0001",
        "token": "secret-token",
        "trace_id": "0123456789abcdef0123456789abcdef",
    }
    for key in keys_for(transform.get("log_statements")):
        sample.pop(key, None)
    leaked = [value for value in ("+237600000000", "+237600000001", "ETU-0001", "secret-token") if value in sample.values()]
    if leaked:
        errors.append(f"valeurs encore présentes après masquage : {leaked}")
    if "trace_id" not in sample:
        errors.append("la politique ne doit pas supprimer trace_id (corrélation journaux ↔ traces)")

    if errors:
        for error in errors:
            print(f"ERREUR  {error}", file=sys.stderr)
        return 1
    print(f"masquage OK · {len(REQUIRED)} attributs · journaux, spans, métriques")
    return 0


if __name__ == "__main__":
    sys.exit(main())
