---
id: T-0023
title: "Reversements : numéro dédié du bénéficiaire, solde vérifié, file à traiter"
feature: F3.3
agent: money
status: review
depends_on: [T-0022]
size: L
owned_paths:
  - services/payments/**
  - db/migrations/payments/**
  - packages/contracts/src/payments/**
reads:
  - docs/STACK.md#3.3
  - agents/money/README.md
  - docs/decisions/0007-grand-livre-double-ecriture.md
contracts_touched:
  - packages/contracts/src/payments/index.ts
deps_request: []
human_gate: true
reviewers: [security, qa]
branch: "agent/money/T-0020-paiements-reels"
worktree: "../worktrees/T-0020"
pr: ""
notes: "Le numéro de reversement est distinct du WhatsApp : il est enregistré par le bénéficiaire dans payout_accounts, jamais journalisé, masqué dans les réponses."
---

## Objectif

Payer les bénéficiaires (restaurant, prestataire, organisateur) sur **leur**
numéro mobile money, par opérateur, après vérification du solde ; un échec ne
perd pas d'argent et atterrit dans une file « à traiter ».

## Contexte et règles métier

- `agents/money/README.md` : « reversement = décaissement par bénéficiaire et
  par opérateur, solde vérifié d'abord » ; « numéro de reversement ≠ WhatsApp ».
- `docs/STACK.md` §3.3.8-3.3.9 : un décaissement par bénéficiaire et par
  opérateur, solde lu par opérateur, ER301 si insuffisant.
- Le numéro est une donnée personnelle : jamais dans un journal, masqué dans
  l'API (`2376••••123`).

## À livrer

1. Table `payout_accounts` (propriétaire interne, opérateur, MSISDN) avec un
   seul compte actif par propriétaire.
2. `POST /payout-accounts` (JWT) : validation du format `2376XXXXXXXX`,
   opérateur `mtn_momo` ou `orange_money` seulement ; réponse masquée.
3. Table `payouts` : statut `queued | processing | sent | failed`, référence
   fournisseur, tentatives, motif, contrainte d'unicité (un reversement actif
   par paiement).
4. `release()` : résout le compte du bénéficiaire, vérifie le solde de **son**
   opérateur, décaisse, puis écrit `PROVIDER_PAYABLE → CASH` ; échec →
   `queued` avec motif, paiement toujours sous séquestre, `payout.failed` publié.
5. Reprise des `queued` par la tâche de relève, avec plafond de tentatives.

## Critères d'acceptation

- [ ] Un numéro qui n'est pas `2376[5-9]XXXXXXXX` est refusé avant tout appel.
- [ ] Un opérateur autre que MTN/Orange est refusé.
- [ ] Solde insuffisant → `queued`, motif `insufficient_provider_balance`, aucune écriture.
- [ ] Succès → une seule écriture `PROVIDER_PAYABLE` débit / `CASH` crédit, équilibrée.
- [ ] Deux appels `release` concurrents ne produisent qu'un décaissement.
- [ ] Le numéro n'apparaît dans aucun journal ni dans une réponse API en clair.

## Hors périmètre

- Le remboursement au payeur (déjà en place, écriture `ESCROW → CASH`).
- Les écrans back-office (F3.5).

## Preuves attendues dans la PR

- Tests : refus de numéro, solde insuffisant, idempotence, écriture du décaissement.
