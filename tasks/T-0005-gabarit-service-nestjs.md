---
id: T-0005
title: "Gabarit de service NestJS et générateur"
feature: F0.5
agent: architect
status: review
depends_on: [T-0002, T-0004]
size: M
owned_paths:
  - services/_template/**
  - services/_runtimes/**
  - tools/**
  - package.json
  - docs/decisions/**
reads:
  - docs/STACK.md#2-compléments-recommandés-à-confirmer
  - docs/STACK.md#4-structure-du-monorepo
  - docs/STACK.md#5-docker-et-kubernetes-en-perspective
  - docs/product/ARCHITECTURE.md#10-stack-technique-par-service
  - tasks/T-0004-paquets-partages-contrats-evenements.md
contracts_touched: []
deps_request: []
human_gate: false
reviewers: [architect, security]
branch: ""
worktree: ""
pr: ""
notes: "Livré par la piste v1 : `services/_template`, `packages/service-kit` et `db/migrations/template/` sont en place et servent de base aux seize services. Tâche close côté code ; reste la relecture humaine."
---

## Objectif

`pnpm new:service <nom>` crée un service identique pour tous : config validée, connexion par schéma et rôle, migrations, outbox/inbox, santé, logs masqués, traces, garde JWT, manifeste de routes.

## Contexte et règles métier

`docs/product/ARCHITECTURE.md` §1 : un service = un domaine = un schéma PostgreSQL, aucun accès au schéma d'un autre. Phase A : les modules se composent en quelques déployables (`services/_runtimes/core`, `money`), séparer un service plus tard ne doit pas toucher au code métier.

## À livrer

1. `services/_template` : NestJS, configuration Zod, Kysely par schéma et rôle, `node-pg-migrate` avec dossier horodaté, outbox/inbox câblées, `/health` et `/ready`, `pino` avec masquage PII, OpenTelemetry, garde JWT JWKS, `gateway.routes.json`, Dockerfile paramétrable.
2. `tools/new-service` et script `pnpm new:service`.
3. Scripts `db:migrate`, `db:codegen`, `test:integration`.
4. Exemple minimal publiant et consommant un événement ; runtimes `_runtimes/core` et `_runtimes/money`.

## Critères d'acceptation

- [ ] un service généré passe lint, types, tests et la CI
- [ ] il publie et consomme un événement dans un test d'intégration réel
- [ ] une trace traverse le service de bout en bout
- [ ] ajouter un second service ne modifie aucun fichier existant

## Hors périmètre

Logique de domaine, contrats de domaine, écrans.

## Preuves attendues dans la PR

Sortie de `pnpm new:service demo`, résultats CI du service généré, trace exportée, diff nul sur les fichiers existants.
