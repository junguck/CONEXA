---
id: T-0052
title: "Écrans étudiant : plans, achat, paiement en attente, factures"
feature: F3.5
agent: money
status: review
depends_on: [T-0025, T-0026]
size: M
owned_paths:
  - apps/web/src/app/(app)/billing/**
  - apps/web/src/features/money/**
  - docs/domain/money.md
  - docs/STATUS.md
reads:
  - docs/product/API.md#3.13
  - docs/product/API.md#3.16
  - docs/domain/money.md
contracts_touched: []
deps_request: []
human_gate: false
reviewers: [qa]
branch: agent/money/T-0052-ecrans-abonnement
worktree: ../worktrees/T-0052
pr: ""
notes: "Entrée de navigation (nav.ts) et regénération du registre : à faire par web-core (nav.generated.ts hors chemins de money). F3.5 est coupée en deux : T-0052 (web étudiant) et T-0053 (back-office finance). Le manifeste gateway de billing n'exposait pas GET /billing/invoices alors que le contrôleur le sert : une ligne ajoutée dans services/billing/gateway.routes.json (chemin de l'agent money, hors owned_paths de la tâche, justifié par l'écran des factures)."
---

## Objectif

Donner à l'étudiant les écrans de l'argent : voir les plans, s'abonner, suivre un
paiement « en attente de confirmation sur votre téléphone » avec reprise s'il
ferme l'app, consulter ses factures.

## Règles

- Le front n'affiche que ce que le serveur renvoie : prix, statut, droits, remise.
- Aucune règle de grâce, de remise ou de commission calculée localement.
- État d'attente repris au rechargement : l'état vient de `GET /billing/me`
  (abonnement `pending`), jamais d'un état local seul.
- Aucun numéro de téléphone dans l'analytique ni dans le stockage local.
- Montants en FCFA entiers, séparateur d'espace.

## Critères d'acceptation

- [ ] Écran plans : liste serveur, plan courant marqué, plan gratuit sans paiement.
- [ ] Achat : souscription avec `Idempotency-Key`, état d'attente, reprise au rechargement.
- [ ] États couverts : réussite, échec, expiration (tests de la logique de vue).
- [ ] Abonnement : statut, période, grâce (`past_due`), résiliation différée lisibles.
- [ ] Factures : liste avec numéro, remise, total, statut.
- [ ] `pnpm --filter @conexa/web lint typecheck test build` verts.
- [ ] `docs/domain/money.md` à jour.

## Hors périmètre

- Back-office finance (T-0053), saisie du numéro de reversement (endpoint absent côté serveur),
  page d'équipe Pro (pas d'abonnement d'équipe dans billing aujourd'hui), parcours e2e Playwright
  et captures mobile (pas d'infrastructure Playwright dans `apps/web`).
