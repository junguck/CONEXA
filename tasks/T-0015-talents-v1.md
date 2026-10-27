---
id: T-0015
title: "Talents v1 : compétences, publications, missions, événements"
feature: F5.1
agent: talents
status: review
depends_on: [T-0010]
size: L
owned_paths:
  - services/talents/**
  - db/migrations/talents/**
  - packages/contracts/src/talents/**
  - packages/events/src/talents/**
  - docs/domain/talents.md
reads:
  - docs/product/API.md#3-10-projets-et-compétences
  - docs/product/API.md#3-11-missions-rémunérées-et-avis
  - docs/product/API.md#3-12-événements-et-billets
  - docs/decisions/0003-schema-base-reconstitue.md
contracts_touched:
  - packages/contracts/src/talents/**
deps_request: []
human_gate: false
reviewers: [architect, security]
branch: v1/talents
worktree: v1-talents
pr: ""
notes: "Branche v1/talents, dérivée de v1/socle. Payments et Billing sont absents de la v1 : interfaces PaymentsGateway et EntitlementsGateway avec doubles, aucune écriture d'argent en base."
---

## Objectif

Publier un besoin ou une compétence, candidater, contractualiser une mission séquestrée, livrer, valider, laisser un avis ; créer un événement et enregistrer des participants.

## À livrer

1. Migrations `talents` : compétences et niveaux, publications, candidatures, recommandations, missions et jalons, avis, rencontres « meeter », événements, inscriptions et billets.
2. Contrats : `Post`, `Mission`, `Event`, `Review`, erreurs.
3. Endpoints : compétences, `PUT /me/skills`, publications (création, liste, détail, clôture, candidatures), missions (proposer, accepter, financer, livrer, approuver, litige, annuler), avis, événements (création, inscription, billet, check-in), meetups.
4. Règles : commission et quotas lus dans les droits (jamais en dur), argent uniquement via `PaymentsGateway`, machine à états des missions, avis seulement après mission terminée.
5. `docs/domain/talents.md`.

## Critères d'acceptation

- [ ] une mission non financée ne peut pas être livrée puis approuvée
- [ ] la commission vient du portefeuille de droits (test avec un double qui change le taux)
- [ ] avis refusé si la mission n'est pas terminée
- [ ] aucun montant écrit directement par le service : tout passe par l'interface de paiement
- [ ] migrations appliquées sur PostgreSQL réel

## Hors périmètre

Séquestre réel, facturation, embeddings de recommandation, messagerie temps réel, écrans.

## Preuves attendues dans la PR

Tests de la machine à états et de la commission, sortie des migrations.
