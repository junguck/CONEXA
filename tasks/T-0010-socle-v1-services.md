---
id: T-0010
title: "Socle v1 : contrats, kit de service, migrations, compose"
feature: F0.4
agent: architect
status: review
depends_on: [T-0001]
size: M
owned_paths:
  - packages/contracts/**
  - packages/errors/**
  - packages/events/**
  - packages/service-kit/**
  - services/_template/**
  - db/migrations/template/**
  - tools/db-migrate.mjs
  - deploy/compose.dev.yaml
  - docs/decisions/**
  - agents/ownership.yaml
reads:
  - docs/product/API.md#1-conventions
  - docs/product/ARCHITECTURE.md#1-principes
  - docs/STACK.md#4-structure-du-monorepo
contracts_touched:
  - packages/contracts/src/common/**
  - packages/events/src/index.ts
deps_request: []
human_gate: true
reviewers: [architect, security]
branch: "v1/socle"
worktree: "../worktrees/v1-socle"
pr: ""
notes: "À fusionner EN PREMIER : les six branches de service en dérivent. Modifie agents/ownership.yaml (chemin soumis à human-ok). NestJS 12 étant ESM, les services passent en ESM + Vitest (ADR 0004) et les migrations sont reconstituées (ADR 0003)."
---

## Objectif

Fournir le socle commun sur lequel s'appuient les six premiers services : contrats Zod, erreurs, événements, kit de service NestJS, gabarit, runner de migrations, infrastructure de développement.

## À livrer

1. `@conexa/contracts` : montants FCFA, pagination par curseur, catalogue des codes d'erreur de `API.md`, rôles, revendications JWT.
2. `@conexa/errors` : `AppError` typée et raccourcis.
3. `@conexa/events` : enveloppe versionnée, bus en mémoire (outbox/RabbitMQ reportés).
4. `@conexa/service-kit` : config Zod, Kysely borné au schéma, JWT RS256/JWKS, garde, filtre d'erreurs, request-id, pino masqué, `/health` et `/ready`.
5. `services/_template` + manifeste de routes ; `db/migrations/template/0001_init.sql`.
6. `tools/db-migrate.mjs` ; `deploy/compose.dev.yaml` (PostgreSQL pgvector, Redis, RabbitMQ).
7. ADR 0003 (migrations reconstituées), 0004 (ESM/Vitest), 0005 (kit partagé).

## Critères d'acceptation

- [x] `pnpm turbo run build typecheck test lint` vert sur le socle et le gabarit
- [x] le gabarit répond `200` sur `/health`, `200` sur `/ready`, `404` en enveloppe d'erreur avec `X-Request-Id`
- [x] un jeton RS256 valide passe le garde, un jeton expiré est refusé (`UNAUTHENTICATED`)
- [x] les numéros WhatsApp et matricules sont masqués dans les journaux et les helpers
- [x] `node tools/db-migrate.mjs template` applique la migration sur PostgreSQL 18 réel
- [x] `pnpm docs:verify` vert

## Hors périmètre

Logique métier des services, publication RabbitMQ, pgvector, générateur `pnpm new:service` (F0.5).

## Preuves attendues dans la PR

Sorties des commandes, migration appliquée (liste des tables), ADR.
