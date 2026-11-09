---
id: T-0058
title: "Dating : saga de réservation d'un date (machine, actions persistées, compensations)"
feature: F4.5
agent: dating
status: review
depends_on: [T-0055, T-0056]
size: L
owned_paths:
  - services/dating/**
  - db/migrations/dating/**
  - docs/domain/dating.md
reads:
  - docs/product/ARCHITECTURE.md#6.1
  - docs/domain/partners.md
  - docs/domain/money.md
contracts_touched: []
deps_request: []
human_gate: false
reviewers: [architect, qa]
branch: agent/dating/T-0058-saga-reservation
worktree: ../worktrees/T-0058
pr: ""
notes: "Moteur de saga livré et testé (13 tests de machine, 4 d'adaptateurs, 9 d'intégration PostgreSQL avec pannes injectées) mais NON branché sur dates.service.ts : dating réserve encore dans restaurant_slots local et simule le paiement. Brancher demande de pointer dates.slot_id vers les créneaux de Partners, décision d'architecture à valider (voir docs/domain/dating.md). Dépend fonctionnellement de #11 (retenues) ; PR indépendante côté code (HTTP par ports)."
---

## Objectif

Orchestrer « retenir la table → payer → confirmer » avec compensation, sans perdre d'action en cas de crash.

## Critères d'acceptation

- [x] Saga avec échecs injectés : paiement refusé, créneau perdu, expiration de la retenue.
- [x] Argent arrivé hors chemin nominal toujours remboursé, une seule fois.
- [x] Actions persistées et reprises après crash, sans doublon.
- [x] Événements simultanés : une seule confirmation de table.
- [ ] Branchement sur `pay` / `cancel` de `dates.service.ts` (décision d'architecture requise).
- [ ] Commission figée copiée dans le date.

## Hors périmètre

- Cartes de négociation, `resolvePayer`, annulation 3 h (déjà en place), crédit restaurant, bus réel.
