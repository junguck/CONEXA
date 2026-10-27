#!/usr/bin/env python3
"""Valide la configuration de la pile d'observabilité (F0.6), sans Docker.

Vérifie les fichiers YAML/JSON, les pipelines du collecteur, les cibles
Prometheus, les règles d'alerte, les sources Grafana et la corrélation
journaux ↔ traces. À lancer avant d'ouvrir une PR ou de démarrer la pile.
"""
from __future__ import annotations

import json
import pathlib
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OBS = ROOT / "deploy/observability"
DASHBOARDS = OBS / "grafana/dashboards"
DATASOURCES = OBS / "grafana/provisioning/datasources/datasources.yml"


def load_yaml(path: pathlib.Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def main() -> int:
    errors: list[str] = []

    collector = load_yaml(OBS / "otel-collector.yaml")
    exporters = collector.get("exporters") or {}
    for name in ("otlp/tempo", "otlphttp/loki", "prometheus"):
        if name not in exporters:
            errors.append(f"collecteur : exporteur {name} manquant")
    pipelines = (collector.get("service") or {}).get("pipelines") or {}
    expected = {
        "traces": "otlp/tempo",
        "logs": "otlphttp/loki",
        "metrics": "prometheus",
    }
    for pipeline, exporter in expected.items():
        if exporter not in (pipelines.get(pipeline) or {}).get("exporters", []):
            errors.append(f"collecteur : pipeline {pipeline} ne va pas vers {exporter}")
    if "transform" not in ((pipelines.get("logs") or {}).get("processors") or []):
        errors.append("collecteur : le pipeline logs doit passer par transform")

    prometheus = load_yaml(OBS / "prometheus.yml")
    jobs = {job.get("job_name") for job in prometheus.get("scrape_configs") or []}
    for job in ("otel-collector", "tempo", "loki", "grafana", "rabbitmq"):
        if job not in jobs:
            errors.append(f"prometheus : cible {job} manquante")
    if "/etc/prometheus/alerts.yml" not in (prometheus.get("rule_files") or []):
        errors.append("prometheus : alerts.yml non chargé")

    alerts = load_yaml(OBS / "alerts.yml")
    rule_count = 0
    for group in alerts.get("groups") or []:
        for rule in group.get("rules") or []:
            rule_count += 1
            for field in ("alert", "expr", "for", "labels"):
                if field not in rule:
                    errors.append(f"alerte {rule.get('alert', '?')} : champ {field} manquant")
    if rule_count < 8:
        errors.append(f"alertes : seulement {rule_count} règles, attendu au moins 8")

    tempo = load_yaml(OBS / "tempo-config.yaml")
    generator = tempo.get("metrics_generator") or {}
    if not (generator.get("storage") or {}).get("remote_write"):
        errors.append("tempo : remote_write des métriques manquant")
    if "span-metrics" not in str(tempo.get("overrides") or {}):
        errors.append("tempo : processeur span-metrics non activé")

    loki = load_yaml(OBS / "loki-config.yaml")
    if not (loki.get("limits_config") or {}).get("allow_structured_metadata"):
        errors.append("loki : allow_structured_metadata doit être activé (OTLP)")

    sources = load_yaml(DATASOURCES).get("datasources") or []
    uids = {source.get("uid") for source in sources}
    for uid in ("prometheus", "loki", "tempo"):
        if uid not in uids:
            errors.append(f"grafana : source {uid} manquante")
    tempo_source = next((source for source in sources if source.get("uid") == "tempo"), {})
    if (tempo_source.get("jsonData") or {}).get("tracesToLogsV2", {}).get("datasourceUid") != "loki":
        errors.append("grafana : Tempo doit pointer vers Loki pour les journaux")
    loki_source = next((source for source in sources if source.get("uid") == "loki"), {})
    if (loki_source.get("jsonData") or {}).get("derivedFields", [{}])[0].get("datasourceUid") != "tempo":
        errors.append("grafana : Loki doit pointer vers Tempo pour trace_id")

    dashboards = sorted(DASHBOARDS.glob("*.json"))
    if len(dashboards) < 4:
        errors.append(f"grafana : {len(dashboards)} tableau(x) de bord, attendu 4")
    for path in dashboards:
        try:
            dashboard = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            errors.append(f"{path.name} : JSON invalide ({error})")
            continue
        if not dashboard.get("uid") or not dashboard.get("panels"):
            errors.append(f"{path.name} : uid ou panneaux manquants")
        for panel in dashboard.get("panels") or []:
            datasource = (panel.get("datasource") or {}).get("uid")
            if datasource and datasource not in uids:
                errors.append(f"{path.name} : panneau {panel.get('title')} pointe vers {datasource} inconnue")

    if errors:
        for error in errors:
            print(f"ERREUR  {error}", file=sys.stderr)
        return 1
    print(f"observabilité OK · {rule_count} alertes · {len(dashboards)} tableaux de bord")
    return 0


if __name__ == "__main__":
    sys.exit(main())
