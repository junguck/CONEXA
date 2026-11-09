---
id: T-0053
title: "Back-office finance : rapprochement, remboursements à traiter, plans, codes promo"
feature: F3.5
agent: money
status: blocked
depends_on: [T-0052]
size: M
owned_paths:
  - apps/backoffice/src/app/(admin)/money/**
  - apps/backoffice/src/features/money/**
  - docs/domain/money.md
reads:
  - docs/product/API.md#3.14
  - docs/product/API.md#3.16
  - docs/domain/money.md
contracts_touched: []
deps_request: []
human_gate: true
reviewers: [security, qa]
branch: agent/money/T-0053-backoffice-finance
worktree: ../worktrees/T-0053
pr: ""
notes: "BLOQUÉE le 2026-11-09 : aucune API admin d'argent n'est exposée par le Gateway. Rapprochement (`/internal/reconciliation/*`), reversements (`/internal/payouts*`), solde (`/internal/ledger/balance`) et remboursement (`/internal/payments/:id/refund`) sont tous `internal` ; `POST /admin/payments/{id}/refund` (API.md §3.14) n'existe pas ; billing n'a ni liste admin des plans ni CRUD des codes promo. Un écran sans endpoint serait une maquette (le back-office finance actuel `features/finance` l'est déjà). Option proposée : tâche préalable T-0054 (money, contrat d'abord, validation humaine + security) qui publie des routes `/admin/money/*` avec rôle admin vérifié par le Gateway : GET reconciliation/latest, POST reconciliation/run, GET payouts, POST payouts/:id/retry, GET payments?status=refund_pending, POST payments/:id/refund, GET/POST billing plans et promo-codes. T-0053 reprend ensuite."
---

## Objectif

Remplacer la maquette `apps/backoffice/src/features/finance` par des écrans branchés : finance,
rapprochement quotidien, remboursements à traiter, plans, codes promo.

## Critères d'acceptation

- [ ] Rapprochement : dernier rapport, écart, relance manuelle (admin).
- [ ] Remboursements à traiter et reversements en échec, avec reprise.
- [ ] Plans et codes promo lisibles et modifiables par l'admin.
- [ ] Le front n'affiche et n'autorise que ce que le serveur renvoie ; aucune PII.
- [ ] lint, typecheck, test, build de `@conexa/backoffice` verts ; `docs/domain/money.md` à jour.

## Hors périmètre

- Création des routes `/admin/money/*` (tâche préalable, contrat d'abord, revue `security`).
