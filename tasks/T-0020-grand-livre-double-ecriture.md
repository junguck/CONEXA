---
id: T-0020
title: "Grand livre à double écriture : ADR, doc Campay et invariants"
feature: F3.1
agent: money
status: review
depends_on: []
size: L
owned_paths:
  - services/payments/**
  - db/migrations/payments/**
  - packages/contracts/src/payments/**
  - packages/events/src/payments/**
  - docs/domain/money.md
  - docs/decisions/0008-grand-livre-double-ecriture.md
  - docs/vendor/campay.md
  - tasks/T-0020-grand-livre-double-ecriture.md
  - tasks/T-0021-adaptateur-campay.md
  - tasks/T-0022-releve-secours-paiements-pending.md
  - tasks/T-0023-reversements-beneficiaires.md
  - tasks/T-0024-rapprochement-quotidien.md
  - tasks/T-0025-paquet-entitlements-evenement.md
  - tasks/T-0026-factures-codes-promo-grace-expiration.md
reads:
  - AGENTS.md
  - agents/money/README.md
  - docs/product/ARCHITECTURE.md#6
  - docs/product/ARCHITECTURE.md#7
  - docs/STACK.md#3
  - docs/ROADMAP.md#F3.1
contracts_touched:
  - packages/contracts/src/payments/index.ts
deps_request: []
human_gate: true
reviewers: [architect, security, qa]
branch: "agent/money/T-0020-paiements-reels"
worktree: "../worktrees/T-0020"
pr: ""
notes: "Task numbers T-0020 à T-0026 sont réservés à l'agent money. docs/decisions et docs/vendor sont ajoutés aux owned_paths de cette tâche : aucun autre agent ne les produit et l'ADR est exigé avant le code (agents/money/README.md)."
---

## Objectif

Poser la comptabilité du domaine argent : un ADR qui remplace le grand livre
d'origine (écriture simple) par une **double écriture** validée par un humain,
une fiche fournisseur Campay qui ne contient que des faits sourcés, et les
invariants testés qui rendent l'argent vérifiable (`séquestre = écritures`,
`débits = crédits`, montants entiers).

## Contexte et règles métier

- `agents/money/README.md` : « le grand livre doit être à double écriture (ADR
  validé par un humain avant le code) ». Le code existe déjà avec l'invariant
  testé ; l'ADR manquait.
- `docs/STACK.md` §3.1 est la seule source confirmée sur Campay. §3.2 liste ce
  qui reste ouvert : URL, webhook et signature, frais, remboursement natif,
  séquestre natif, prélèvement récurrent, cadre juridique.
- Aucun numéro de téléphone, aucun secret dans le code, les journaux ou les tests.

## À livrer

1. `docs/decisions/0008-grand-livre-double-ecriture.md`, statut **proposé** :
   plan comptable, sens des écritures, arrondis FCFA, compensation d'une erreur,
   rapprochement, conséquences et points à valider par un humain.
2. `docs/vendor/campay.md` : uniquement le confirmé, le reste en « ouvert » avec
   la tâche bloquée correspondante. Aucune URL ni forme de requête inventée.
3. `services/payments/src/ledger.ts` : écritures d'encaissement, de libération,
   de décaissement et de remboursement, chacune équilibrée, plus le calcul de
   commission à l'arrondi inférieur (jamais un franc créé).
4. `docs/domain/money.md` : état réel du domaine, commandes, invariants.

## Critères d'acceptation

- [ ] ADR 0008 présent, statut `proposé`, liste explicite de ce qu'un humain doit trancher.
- [ ] `docs/vendor/campay.md` ne contient aucun endpoint non sourcé ; chaque point
      ouvert renvoie à une tâche ou à un blocage nommé.
- [ ] Toute écriture produite par `ledger.ts` est équilibrée (`assertBalanced`).
- [ ] `commission_fcfa + net_fcfa = amount_fcfa` au franc près, testé sur des
      montants impairs (1 999 FCFA à 8 %).
- [ ] Aucun montant non entier ni négatif accepté.

## Hors périmètre

- Les appels HTTP réels à Campay (T-0021, bloquée tant que l'API n'est pas confirmée).
- Les écrans (F3.5).

## Preuves attendues dans la PR

- Sortie de `pnpm turbo run lint typecheck test --filter=@conexa/payments`.
- Extrait de l'ADR et de `docs/vendor/campay.md`.
