---
id: T-0022
title: "Relève de secours des paiements en attente et abandon propre"
feature: F3.2
agent: money
status: review
depends_on: [T-0020]
size: M
owned_paths:
  - services/payments/**
  - db/migrations/payments/**
reads:
  - docs/STACK.md#3.3
  - docs/decisions/0007-grand-livre-double-ecriture.md
contracts_touched: []
deps_request: []
human_gate: true
reviewers: [qa, security]
branch: "agent/money/T-0020-paiements-reels"
worktree: "../worktrees/T-0020"
pr: ""
notes: "La planification est pure et testée ; la boucle réseau lit le statut via PaymentProvider (FakeProvider en CI)."
---

## Objectif

Ne jamais laisser un paiement `pending` pour toujours : une tâche relit le
statut chez l'agrégateur, applique la même transition qu'un webhook, et abandonne
proprement après expiration.

## Contexte et règles métier

- `docs/STACK.md` §3.3.4 : interroger les `pending` **toutes les 30 s pendant
  15 min, puis toutes les 5 min**, abandon propre après expiration.
- Un webhook peut être perdu : la relève est la garantie de convergence.
- Un webhook peut être rejoué : la transition est idempotente (T-0020).

## À livrer

1. Colonnes `next_check_at`, `checks`, `expires_at`, `failure_reason` sur `payments`.
2. `payments.polling.ts` : `nextCheckAt(createdAt, checks)` (30 s sur les 15
   premières minutes, 5 min ensuite) et `decidePoll(...)` (transition, report,
   abandon) — fonctions pures.
3. `PaymentPoller` : sélectionne `next_check_at <= now`, appelle
   `provider.getStatus`, applique `decidePoll` en transaction.
4. Abandon : `pending → failed` avec `failure_reason = 'expired'`, événement
   `payment.failed`, aucune écriture comptable.

## Critères d'acceptation

- [ ] 30 s pendant 15 min puis 300 s, testé aux bornes (14 min 59 s / 15 min / 16 min).
- [ ] Un paiement expiré ne fait l'objet d'aucune nouvelle relève.
- [ ] Statut fournisseur `successful` → `escrow` avec écriture équilibrée, une seule fois.
- [ ] Statut `failed` → `failed`, sans écriture.
- [ ] Une erreur réseau reporte la relève sans changer l'état.

## Hors périmètre

- Rapprochement quotidien (T-0024).

## Preuves attendues dans la PR

- Tests de `nextCheckAt`/`decidePoll` (bornes, idempotence, abandon).
