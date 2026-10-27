---
id: T-0051
title: "Alignement canonique des paquets partagés sur la piste v1"
feature: F0.4
agent: architect
status: review
depends_on: [T-0004, T-0010]
size: M
owned_paths:
  - packages/contracts/**
  - packages/events/**
  - packages/errors/**
  - packages/messaging/**
  - docs/decisions/**
  - agents/ownership.yaml
  # Sections « Propriété » régénérées par `pnpm agents:ownership` après la mise à jour
  # de ownership.yaml : fichiers générés, à reverser à l'orchestrateur.
  - agents/architect/README.md
  - agents/platform/README.md
  - agents/realtime/README.md
  - tasks/T-0004-paquets-partages-contrats-evenements.md
  - pnpm-lock.yaml
  # Déblocage de fusion : le hook pre-commit échouait sur `tests/e2e/v1-smoke.mjs`
  # (`'fetch' is not defined`) livré par main. Une ligne, la convention du dépôt
  # (`/* global fetch */` comme dans tests/e2e/helpers.mjs) : à reverser à qa.
  - tests/e2e/v1-smoke.mjs
  # Résolution de fusion uniquement : les cinq appels `bus.publish(createEvent(...))`
  # de la piste v1 deviennent des lots, le port EventPublisher restant strictement
  # par lot (ADR 0007). Aucune modification de logique métier.
  - services/football/src/teams.service.ts
  - services/football/src/matches.service.ts
  - services/football/src/match-report.service.ts
reads:
  - docs/decisions/0007-format-evenements.md
  - agents/ownership.yaml
  - tasks/T-0004-paquets-partages-contrats-evenements.md
  - docs/STACK.md#9-conseils-d-ingénierie-agentique
contracts_touched:
  - packages/contracts/src/common/**
  - packages/events/src/common/**
deps_request: []
human_gate: true
reviewers: [architect, security]
branch: "agent/architect/T-0051-alignement-canonique"
worktree: "C:\\Users\\EG\\Desktop\\Conexa\\worktrees\\T-0051"
pr: ""
notes: "Fusion de T-0004 dans la piste v1 (main), qui avait posé ses propres paquets contracts/errors/events. Résolutions : (1) une seule source du catalogue d'erreurs — @conexa/errors, contrats dépend de lui, le cycle @conexa/errors → @conexa/contracts est supprimé ; (2) deux codes v1 conservés (UPLOAD_TOO_LARGE 413, UPLOAD_TYPE_NOT_ALLOWED 415) et openapi/common.json régénéré ; (3) packages/messaging renommé @conexa/event-messaging (collision de nom avec services/messaging : Turborepo refuse deux identités identiques) ; (4) ADR renuméroté 0006 → 0007, main ayant pris 0006 pour les vecteurs de rencontre ; (5) port EventPublisher strictement par lot (ADR 0007) : les cinq appels unitaires de services/football ont été convertis en lots — et deux boucles de publication fusionnées en un seul lot. human_gate: ownership.yaml a été complété (packages/{contracts,events} déclarés à architect, services/{messaging,notifications} à realtime, charpente racine à platform) : c'était la demande needs-human de T-0004. Les fichiers de test v1 et canoniques sont fusionnés (aucune assertion perdue) et les deux fichiers de tests d'événements sont réunis."
---

## Objectif

Rendre les paquets partagés livrés par T-0004 utilisables sur `main` : une seule source pour le
catalogue d'erreurs, un seul baril de contrats, un port de publication strictement par lot, et un
outbox/inbox prêt à être branché par les services. Sans cette fusion, aucun événement ne traverse un
processus (les services publient dans un `InMemoryEventBus`) et le reste des jalons J1/J2 est bloqué.

## Contexte et règles métier

`docs/product/ARCHITECTURE.md` §1 : un service = un domaine = un schéma ; la communication
asynchrone passe par le bus, avec *outbox* (écriture dans la transaction métier) et *inbox*
(idempotence à la réception). `docs/STACK.md` §1 impose RabbitMQ ; §9 règle 2 impose que le
producteur d'un contrat le publie avant les consommateurs. L'ADR `docs/decisions/0007-format-evenements.md`
fixe l'enveloppe, la politique de reprise et la topologie.

## À livrer

1. `@conexa/errors` : source unique du catalogue de codes métier (API.md §1), table code → HTTP,
   `AppError`, enveloppe sûre, helpers v1 conservés.
2. `@conexa/contracts` : primitives canoniques (UUID, ISO UTC, FCFA, pagination par curseur,
   enveloppe d'erreur) + les contrats de domaine de la piste v1 dans le même baril ; OpenAPI 3.1
   généré et committé.
3. `@conexa/events` : enveloppe validée, garde-fou PII, JSON Schema versionné committé, port
   `EventPublisher` **par lot**, `InMemoryEventBus` pour les tests, aliases v1.
4. `@conexa/event-messaging` : outbox transactionnelle, inbox idempotente, reprise à délai
   croissant, topologie RabbitMQ, DDL outbox/inbox.
5. Tests : tests unitaires des deux pistes réunis (aucune assertion perdue).
6. `agents/ownership.yaml` complété pour que la garde de propriété soit vérifiable.

## Critères d'acceptation

- [x] `pnpm install` régénère un lockfile unique et installable.
- [x] `pnpm turbo run typecheck` vert sur les 24 paquets.
- [x] `pnpm turbo run test` vert (tests unitaires des deux pistes réunis).
- [x] `pnpm turbo run lint` et `pnpm turbo run build` verts.
- [x] `pnpm format:check` et `pnpm docs:verify` verts.
- [x] `pnpm ci:guards` vert (propriété des chemins comprise).
- [ ] Tests d'intégration RabbitMQ + PostgreSQL réels : non exécutés (exigent la pile locale levée).
- [ ] Branchement des producteurs sur l'outbox : tâche suivante (football, identity, dating,
      marketplace, talents, partners, billing, payments).

## Hors périmètre

- Aucune logique de domaine, aucune route, aucun écran.
- Aucun secret, aucune clé, aucune valeur de production.
- Aucune modification des migrations d'un service.

## Preuves attendues dans la PR

- Sortie de `pnpm verify` et de `pnpm ci:guards`.
- Diff des résolutions de fusion (catalogue d'erreurs unique, renommage du paquet messaging,
  renumérotation de l'ADR, conversion des appels unitaires en lots).
- Note explicite sur les limites : intégration réelle non exécutée.
