---
id: T-0034
title: "Publication fiable des événements football (outbox)"
feature: F2.5
agent: football
status: todo
depends_on: [T-0030]
size: M
owned_paths:
  - services/football/**
  - db/migrations/football/**
  - packages/contracts/src/football/**
  - packages/events/src/football/**
  - docs/domain/football.md
reads:
  - agents/football/README.md
  - docs/product/ARCHITECTURE.md
  - docs/domain/football.md
contracts_touched:
  - packages/events/src/football/index.ts
deps_request: []
human_gate: false
reviewers: [architect]
branch: agent/football/T-0030-litiges-competitions
worktree: ../worktrees/T-0030
pr: ""
notes: "Lot 5/5 : le bus mémoire reste utilisable en test, mais tout événement est d'abord écrit dans une outbox du schéma football puis relayé."
---

## Objectif

Garantir qu'un événement métier (`match.scheduled`, `match.validated`, `match.disputed`) n'est jamais perdu si le bus ou le relais tombe, sans lire de table d'un autre service.

## Contexte et règles métier

`docs/domain/football.md` constate que le bus est en mémoire. L'architecture prévoit une outbox par producteur. Le service ne doit importer ni `packages/events/src/common/**` modifié ni une table d'un autre schéma.

## À livrer

1. Migration : table `event_outbox` (id, type, version, payload jsonb, occurred_at, published_at, attempts) dans le schéma `football`.
2. Code : port `FootballPublisher` (`publish(trx, events)` écrit l'outbox dans la transaction métier ; `relay()` publie via le `EventPublisher` injecté et marque `published_at`) ; relais appelé par le planificateur et par `POST /internal/jobs/relay-outbox`.
3. Tests : un événement est écrit même si le bus échoue, le relais ne publie pas deux fois un événement déjà publié, l'ordre est stable.
4. Documentation : section « Événements publiés » de `docs/domain/football.md`.

## Critères d'acceptation

- [ ] aucune publication directe au bus depuis un service métier (tout passe par l'outbox)
- [ ] la transaction métier et l'écriture d'outbox sont atomiques
- [ ] le relais est idempotent et reprend les événements en attente
- [ ] un échec de bus laisse `published_at` nul et `attempts` incrémenté
- [ ] aucun accès à un schéma étranger

## Hors périmètre

RabbitMQ réel, purge de l'outbox, métriques Prometheus.

## Preuves attendues dans la PR

Test de panne du bus puis reprise, extrait de `event_outbox`.
