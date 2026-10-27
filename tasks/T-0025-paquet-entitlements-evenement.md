---
id: T-0025
title: "Paquet partagé des droits et événement entitlements.changed"
feature: F3.4
agent: money
status: review
depends_on: [T-0020]
size: M
owned_paths:
  - packages/entitlements/**
  - packages/events/src/billing/**
  - services/billing/**
  - packages/contracts/src/billing/**
reads:
  - docs/product/ARCHITECTURE.md#7
  - agents/money/README.md
contracts_touched:
  - packages/events/src/billing/index.ts
  - packages/contracts/src/billing/index.ts
deps_request: []
human_gate: true
reviewers: [architect, qa]
branch: "agent/money/T-0020-paiements-reels"
worktree: "../worktrees/T-0020"
pr: ""
notes: "Marketplace et Talents restent en FixedEntitlementsGateway : leurs services sont hors de mes chemins. Le paquet et la lecture réelle sont livrés, le remplacement côté consommateur revient à leurs agents (tâche à ouvrir). Les schémas d'événements sont dans packages/contracts (payments/billing) : packages/events/package.json et son export map ne sont pas dans les chemins de money."
---

## Objectif

Une seule définition des clés de droits, partagée par le producteur (Billing) et
les consommateurs, et un événement `entitlements.changed` publié à chaque
modification — plus aucun droit codé en dur dans un service.

## Contexte et règles métier

- `ARCHITECTURE.md` §7.1 : Billing est la seule source de vérité, les droits
  gratuits vivent en base, le cache consommateur est purgé par
  `entitlements.changed`.
- §7.3 liste les clés et le service qui les applique.

## À livrer

1. `packages/entitlements` : clés typées, `EntitlementsSchema`, valeurs par
   défaut d'un plan gratuit, `allows()`, `limitOf()` ; aucune dépendance à Nest.
2. `packages/events/src/billing` : `entitlements.changed` (sujet, audience,
   `plan_code`, `changed_at`, `reason`) et `subscription.activated|expired`.
3. Billing publie l'événement à l'activation, à la résiliation, en cas de
   changement de plan et à l'expiration.
4. `GET /internal/entitlements/:kind/:id` (compatibilité avec la nouvelle forme)
   protégé par jeton de service, renvoyant les droits effectifs.

## Critères d'acceptation

- [ ] Aucune clé de droit écrite en dur dans `services/payments`.
- [ ] L'événement est publié exactement une fois par transition.
- [ ] Un plan inconnu ne produit pas de droits silencieux : erreur nommée.
- [ ] `GET /internal/entitlements` répond avec le contrat partagé (test).

## Hors périmètre

- Remplacer `FixedEntitlementsGateway` dans Marketplace/Talents (chemins d'un
  autre agent) : tâche de suivi à ouvrir côté `marketplace` et `talents`.

## Preuves attendues dans la PR

- Tests du paquet, test de publication de l'événement.
