---
id: T-0019
title: "Fusion du front web-core sur main et client Gateway typé"
feature: F0.7
agent: web-core
status: review
depends_on: [T-0007, T-0009]
size: M
owned_paths:
  - apps/**
  - packages/ui/**
  - docs/domain/web-core.md
  - tasks/**
reads:
  - AGENTS.md
  - agents/GIT_WORKFLOW.md
  - agents/web-core/README.md
  - docs/product/API.md#1-conventions
  - tasks/T-0007-design-system-coquille-web-pwa.md
  - tasks/T-0009-coquilles-backoffice-portail.md
contracts_touched: []
deps_request: []
human_gate: false
reviewers: []
branch: "agent/web-core/T-0019-fusion-front"
worktree: "C:\\Users\\EG\\Desktop\\Conexa\\worktrees\\T-0019"
pr: ""
notes: "Fusion de T-0007 (design system, PWA, 23 écrans) et T-0009 (back-office, portail) sur main à 13 services, sans toucher services/, packages/contracts, db/, tools/ ni deploy/. Client d'API pointé sur la Gateway via NEXT_PUBLIC_API_URL (défaut http://localhost:3000) et typé par @conexa/contracts. Vert en local : 20 tâches turbo, 64 tests, build des trois apps, format:check. PR non ouverte : aucun client GitHub (gh/token) sur la machine."
---

## Objectif

Obtenir une branche de front unique, rebasée sur `main`, qui compile et dispose d'un client d'API
typé pour la Gateway.

## À livrer

1. Fusion de T-0007 puis T-0009, conflits résolus en gardant les deux côtés.
2. Client `apps/web/src/shell/api` : `NEXT_PUBLIC_API_URL`, appels typés `@conexa/contracts`,
   chemins alignés sur les manifestes du Gateway, idempotence explicite.
3. `docs/domain/web-core.md` à jour, T-0007 et T-0009 en `review`.
4. Preuves : lint, typecheck, tests, build, format:check, captures design system et football.

## Critères d'acceptation

- [x] `packages/ui` et les trois apps passent lint, typecheck, test, build et format:check.
- [x] Aucun calcul d'Elo, de quota ou de commission côté front.
- [x] Les deux tâches fusionnées pointent vers cette branche et ce worktree.

## Hors périmètre

- Écrire dans `services/**`, `packages/{contracts,events,messaging,service-kit,errors}/**`, `db/**`,
  `tools/**`, `.github/**`, `deploy/**`.
- Fusionner dans `main` : l'orchestrateur le fait.
