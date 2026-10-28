---
id: T-0024
title: "Rapprochement quotidien du grand livre avec le solde par opérateur"
feature: F3.3
agent: money
status: review
depends_on: [T-0023]
size: M
owned_paths:
  - services/payments/**
  - db/migrations/payments/**
  - packages/contracts/src/payments/**
reads:
  - docs/STACK.md#3.3
  - docs/decisions/0008-grand-livre-double-ecriture.md
contracts_touched:
  - packages/contracts/src/payments/index.ts
deps_request: []
human_gate: true
reviewers: [qa, security]
branch: "agent/money/T-0020-paiements-reels"
worktree: "../worktrees/T-0020"
pr: ""
notes: "L'écart est calculé par opérateur et journalisé sans PII ; l'alerte est un événement + une métrique, pas un envoi de message."
---

## Objectif

Prouver chaque jour que le grand livre dit la même chose que l'agrégateur :
somme du compte `CASH` par opérateur contre solde lu chez le fournisseur, écart
nul sinon alerte.

## Contexte et règles métier

- `agents/money/README.md` : « rapprochement quotidien du grand livre avec le
  solde Campay ; tout écart alerte ».
- `docs/STACK.md` §3.3.6 : solde consulté **par opérateur**.
- Après un décaissement, `CASH` diminue : le solde fournisseur et le grand livre
  doivent donc rester égaux (ADR 0008).

## À livrer

1. Table `reconciliations` : jour, opérateur, solde fournisseur, solde comptable,
   écart, statut (`ok` / `mismatch`), horodatage.
2. `reconciliation.ts` : fonction pure `variance(ledgerCashFcfa, providerBalanceFcfa)`.
3. Tâche quotidienne : lit le solde par opérateur (`provider.getBalance`), écrit
   la ligne, émet la métrique `payments.reconciliation.variance_fcfa{operator}`
   et `payment.reconciliation.mismatched` si écart ≠ 0.
4. `GET /internal/reconciliation/latest` protégé par jeton de service.

## Critères d'acceptation

- [ ] Écart 0 → statut `ok`, aucune alerte.
- [ ] Écart ≠ 0 → statut `mismatch`, événement publié avec les deux montants.
- [ ] Une panne du fournisseur n'écrit pas de faux `ok` (ligne `unknown` non
      enregistrée, relève suivante).
- [ ] Le calcul est un entier FCFA, jamais un flottant.

## Hors périmètre

- Correction automatique des écarts : un humain tranche.

## Preuves attendues dans la PR

- Test du calcul d'écart et de la décision d'alerte.
