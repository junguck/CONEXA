---
id: T-0026
title: "Factures, codes promo, période de grâce et expiration des abonnements"
feature: F3.4
agent: money
status: review
depends_on: [T-0025]
size: L
owned_paths:
  - services/billing/**
  - db/migrations/billing/**
  - packages/contracts/src/billing/**
  - packages/events/src/billing/**
reads:
  - docs/product/ARCHITECTURE.md#6.3
  - docs/product/ARCHITECTURE.md#7.4
  - docs/product/ARCHITECTURE.md#7.5
  - docs/product/API.md#3.16
contracts_touched:
  - packages/contracts/src/billing/index.ts
deps_request: []
human_gate: true
reviewers: [architect, qa]
branch: main (travail direct, vague 3)
worktree: ""
pr: ""
notes: "Livré en code le 2026-10-29 : factures (numéro séquentiel), codes promo plafonnés, past_due + 3 jours de grâce, expiration (statut `expired`), résiliation différée, balayage quotidien idempotent + `/internal/billing/jobs/daily-sweep`. Tests : règles pures (promo, grâce aux bornes exactes, transitions) — 14 verts. ATTENTION : la migration `202610291200_invoices_promo_grace.sql` contient un `drop constraint` (élargissement du statut à `expired`) ; la PR exigera l'étiquette `human-ok` (garde migrations, `ALLOW_DESTRUCTIVE`)."
---

## Objectif

Compléter le cycle de vie d'un abonnement payant : facture à chaque achat,
codes promo, 3 jours de grâce après un échec de renouvellement, puis expiration
qui met en pause ce qui dépasse la nouvelle limite.

## Contexte et règles métier

- `ARCHITECTURE.md` §6.3 : `pending_payment` → facture ouverte → paiement →
  activation ; sans paiement, expiration après 24 h.
- §7.4 : 3 jours de grâce (droits conservés), puis expiration ; à l'expiration
  rien n'est supprimé, les éléments au-delà de la limite sont **mis en pause**.
- §7.5 : période prépayée de 30 jours, rappels J-7/J-3/J-1, pas de prélèvement
  récurrent supposé (à vérifier auprès de l'agrégateur).
- Statuts de la table `subscriptions` : `pending | active | past_due | cancelled`
  — la `grâce` correspond à `past_due` avec `grace_until`.

## À livrer

1. Contrat : `Invoice`, `PromoCode`, `SubscribeInput.promo_code` (facultatif).
2. Migration `billing` : `invoices` (numéro séquentiel lisible, montant, remise,
   statut), `promo_codes` (code, remise, limite, fenêtre, audience), colonnes
   `grace_until` et `cancel_at_period_end` sur `subscriptions`.
3. Service : émission de facture à la souscription, application d'un code promo
   (remise en FCFA entiers, jamais négative), `past_due` + `grace_until = +3 j`,
   `expired` à l'échéance avec `entitlements.changed`.
4. Tâche quotidienne : `active` échu → `past_due`, `past_due` échu → `expired`,
   publication d'un événement par transition.

## Critères d'acceptation

- [ ] Une remise ne rend jamais une facture négative ; le total reste entier FCFA.
- [ ] 3 jours de grâce exactement, testés au franc près sur les dates.
- [ ] Un code promo inconnu, expiré ou épuisé est refusé avant tout paiement.
- [ ] Expiration → droits du plan gratuit, `entitlements.changed` publié.
- [ ] Aucun prélèvement automatique codé.

## Hors périmètre

- Écrans d'abonnement et de facturation (F3.5).
- Le prélèvement récurrent, non confirmé.

## Preuves attendues dans la PR

- Tests : promo, grâce, expiration, idempotence du job.

## Livré (2026-10-29)

- Contrat : `Invoice`, `PromoCode`, `SubscribeInput.promo_code`, statuts
  `expired`, événements `invoice.issued`, `subscription.past_due`,
  `subscription.expired`, `subscription.cancelled`
  (`packages/contracts/src/billing/index.ts`).
- Migration `db/migrations/billing/202610291200_invoices_promo_grace.sql` :
  `invoices`, `promo_codes`, `grace_until` et `cancel_at_period_end`, statut
  `expired` (drop/readd de la contrainte — voir `human-ok` ci-dessus).
- Service : facture dans la transaction de souscription, activation contre le
  total de facture, promo (plancier client, plafond, fenêtre), grâce 3 jours,
  expiration avec droits au plan gratuit, résiliation différée,
  `runDailySweep()` idempotent + `POST /internal/billing/jobs/daily-sweep`.
- Doc : [docs/domain/money.md](../docs/domain/money.md) § « Factures, codes
  promo, grâce et expiration ».
