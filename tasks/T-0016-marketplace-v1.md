---
id: T-0016
title: "Marketplace v1 : offres, commandes, machine à états, avis"
feature: F5.5
agent: marketplace
status: todo
depends_on: [T-0010]
size: L
owned_paths:
  - services/marketplace/**
  - db/migrations/marketplace/**
  - packages/contracts/src/marketplace/**
  - packages/events/src/marketplace/**
  - docs/domain/marketplace.md
reads:
  - docs/product/API.md#3-15-services-entre-étudiants-marketplace
  - docs/product/schema_extension.sql
  - docs/decisions/0003-schema-base-reconstitue.md
contracts_touched:
  - packages/contracts/src/marketplace/**
deps_request: []
human_gate: false
reviewers: [architect, security]
branch: ""
worktree: ""
pr: ""
notes: "Branche v1/marketplace, dérivée de v1/socle. Les tables de `schema_extension.sql` (§2 Marketplace) sont reprises ; Payments et Billing sont simulés par des interfaces avec doubles."
---

## Objectif

Publier une offre à formules, recevoir une commande, la faire avancer jusqu'à la livraison, gérer une révision, un litige et un avis.

## À livrer

1. Migrations `marketplace` : catégories, offres, formules, disponibilités, favoris, commandes, événements de commande, révisions, litiges, avis, boosts.
2. Contrats : `ServiceListing`, `ServiceOrder`, `OrderEvent`, erreurs.
3. Endpoints : catégories, recherche, création et gestion d'offre, formules, disponibilités, soumission/pause/reprise, favoris, commandes (`requested → accepted → funded → in_progress → delivered → completed`, `cancelled`, `disputed`), révisions, avis, tableau de bord vendeur.
4. Règles : machine à états fermée, commission figée à la création, offres suspectes refusées (`LISTING_PROHIBITED`), auto-commande interdite, offres en excès mises en pause (jamais supprimées).
5. `docs/domain/marketplace.md`.

## Critères d'acceptation

- [ ] toute transition interdite → `INVALID_STATE` (test exhaustif de la table de transitions)
- [ ] commission figée même si le plan change ensuite
- [ ] commande de sa propre offre → `SELF_ORDER_FORBIDDEN`
- [ ] terme interdit → `LISTING_PROHIBITED`
- [ ] révision au-delà du quota → `REVISIONS_EXHAUSTED`
- [ ] migrations appliquées sur PostgreSQL réel

## Hors périmètre

Séquestre réel (interface de paiement avec double), recherche sémantique, messagerie, écrans.

## Preuves attendues dans la PR

Tests de la machine à états, sortie des migrations, exemple de parcours complet en test.
