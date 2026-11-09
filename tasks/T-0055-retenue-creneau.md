---
id: T-0055
title: "Partners : retenue de créneau de 15 minutes et événements slot.*"
feature: F4.1
agent: partners
status: review
depends_on: []
size: M
owned_paths:
  - services/partners/**
  - db/migrations/partners/**
  - packages/events/src/partners/**
  - docs/domain/partners.md
reads:
  - docs/product/ARCHITECTURE.md#6.1
  - docs/decisions/0007-outbox-transactionnelle.md
  - docs/domain/dating.md
contracts_touched:
  - packages/events/src/partners/slot.held.v1.json
  - packages/events/src/partners/slot.rejected.v1.json
  - packages/events/src/partners/slot.released.v1.json
deps_request: []
human_gate: false
reviewers: [architect, qa]
branch: agent/partners/T-0055-retenue-creneau
worktree: ../worktrees/T-0055
pr: ""
notes: "Première tranche de F4.1 : seule la retenue de créneau est livrée (prérequis de la saga F4.5). Le reste de F4.1 est listé dans docs/domain/partners.md. Test d'intégration PostgreSQL exécuté le 2026-11-09 (6 tests verts, PostgreSQL embarqué)."
---

## Objectif

Permettre à la saga de réservation de retenir une table 15 minutes, sans double réservation
de la dernière place, avec libération automatique et événements fiables.

## Critères d'acceptation

- [x] Règles pures (15 min, borne exacte, capacité, transitions) testées sans base.
- [x] Migration `slot_holds` + `partners_outbox` / `partners_inbox`.
- [x] Retenue sous verrou de ligne, idempotente par `hold_ref`.
- [x] Balayage des retenues échues, rejouable (`skip locked`).
- [x] Événements `slot.held|rejected|released` écrits dans la transaction (outbox) + schémas JSON.
- [x] Test d'intégration PostgreSQL exécuté sur un vrai PostgreSQL embarqué : 8 demandes parallèles sur la dernière table → 1 seule retenue ; balayage rejouable ; outbox sans PII.

## Hors périmètre

- Organisations, candidatures, contrats versionnés, commission figée, numéro de reversement,
  routes `/restaurant/*`, portail restaurant (F4.2).
