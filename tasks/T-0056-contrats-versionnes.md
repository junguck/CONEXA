---
id: T-0056
title: "Partners : contrats versionnés et commission figée"
feature: F4.1
agent: partners
status: review
depends_on: [T-0055]
size: M
owned_paths:
  - services/partners/**
  - db/migrations/partners/**
  - packages/contracts/src/partners/**
  - docs/domain/partners.md
  - tasks/T-0055-retenue-creneau.md
  - packages/events/src/partners/**
reads:
  - docs/product/schema_extension.sql
  - docs/domain/partners.md
contracts_touched:
  - packages/contracts/src/partners/index.ts
deps_request: []
human_gate: false
reviewers: [architect, qa]
branch: agent/partners/T-0056-contrats-reversement
worktree: ../worktrees/T-0056
pr: ""
notes: "Empilée sur T-0055 (PR #11) : réutilise internal.controller.ts et db.ts. À fusionner après #11. Le numéro de reversement (trou n°2) existe déjà côté Payments (T-0023) : pas de colonne dans Partners. Testée sur un vrai PostgreSQL embarqué (migrations + intégration)."
---

## Objectif

Un contrat actif unique par organisation, versionné, et une commission copiée à la réservation.

## Critères d'acceptation

- [x] Règles pures testées (version, proposition unique, signature, instantané).
- [x] Migration avec index unique partiel et reprise des organisations actives.
- [x] Signature concurrente : un seul contrat actif (test PostgreSQL réel).
- [x] La base refuse deux contrats actifs même par écriture directe.
- [x] Commission d'un lieu exposée à la saga (appel interne).

## Hors périmètre

- Candidatures publiques, routes `/restaurant/*`, consommation par la saga (F4.5).
