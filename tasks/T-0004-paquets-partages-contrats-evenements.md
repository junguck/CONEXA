---
id: T-0004
title: "Paquets partagés : contrats, événements, messagerie, erreurs"
feature: F0.4
agent: architect
status: in_progress
depends_on: [T-0001]
size: M
owned_paths:
  - packages/contracts/**
  - packages/events/**
  - packages/messaging/**
  - packages/errors/**
  - docs/decisions/**
reads:
  - docs/product/API.md#1-conventions
  - docs/product/API.md#6-codes-d-erreur
  - docs/product/ARCHITECTURE.md#4-propriété-des-données-et-découpage-de-schema-sql
  - docs/STACK.md#2-compléments-recommandés-à-confirmer
  - docs/STACK.md#7-qualité-et-tests
contracts_touched:
  - packages/contracts/src/common/**
  - packages/events/src/common/**
deps_request: []
human_gate: false
reviewers: [architect, security]
branch: "agent/architect/T-0004-shared-packages"
worktree: "C:\Users\EG\Desktop\Conexa\worktrees\T-0004"
pr: ""
notes: "Contrat d'abord : cette tâche produit le langage commun dont dépendent TOUS les services. Rien ne doit être codé contre ces contrats avant leur fusion. ADR obligatoire pour le format d'événement."
---

## Objectif

Fournir le langage commun de tous les services : montants en entiers FCFA, pagination par curseur, enveloppe d'erreur, catalogue des codes, enveloppe d'événement, outbox/inbox, topologie RabbitMQ.

## Contexte et règles métier

`docs/product/ARCHITECTURE.md` §1 : événements fiables par outbox (écriture dans la même transaction) et inbox (idempotence à la réception) ; un événement n'a qu'un producteur. `docs/STACK.md` §3.3 : nos règles métier vivent en SQL, donc Zod comme source et OpenAPI généré, pas d'ORM imposé.

## À livrer

1. `packages/contracts` : `Money` (entier FCFA), pagination curseur, enveloppe d'erreur, catalogue complet des codes de `API.md`, utilitaires `zod-to-openapi`.
2. `packages/events` : enveloppe (`id`, `type`, `version`, `occurred_at`, `producer`, `traceparent`, `payload`), un fichier par événement, génération JSON Schema.
3. `packages/messaging` : publication depuis la table outbox, consommation avec table inbox idempotente, échange topic, files durables, file des échecs, reprises à délai croissant, propagation de `traceparent` dans les en-têtes AMQP.
4. `packages/errors` : erreurs métier → réponses HTTP au format `API.md`.
5. `pnpm gen:contracts` ; ADR du format d'événement.

## Critères d'acceptation

- [ ] tests d'intégration sur vrai RabbitMQ + PostgreSQL : publication transactionnelle, doublon ignoré, reprise après panne, file des échecs
- [ ] OpenAPI et schémas d'événements générés par `pnpm gen:contracts`
- [ ] tous les codes d'erreur de `API.md` présents et testés
- [ ] aucun événement ne transporte de PII (test automatisé)

## Hors périmètre

Contrats de domaine (chaque agent les possède), logique métier, migrations de domaine.

## Preuves attendues dans la PR

Sortie des tests d'intégration, OpenAPI généré, ADR fusionné, liste des codes d'erreur couverts.
