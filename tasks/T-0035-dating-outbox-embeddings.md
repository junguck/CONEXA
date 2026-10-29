---
id: T-0035
title: "Producteur dating.embedding_requested (outbox canonique)"
feature: F4.3
agent: dating
status: review
depends_on: [T-0051, T-0014]
size: M
owned_paths:
  - services/dating/**
  - db/migrations/dating/**
  - packages/contracts/src/dating/**
  - packages/events/src/dating/**
  - docs/domain/dating.md
reads:
  - agents/dating/README.md
  - docs/product/ARCHITECTURE.md
  - docs/domain/dating.md
contracts_touched:
  - packages/events/src/dating/index.ts
deps_request: []
human_gate: false
reviewers: [architect, ai]
branch: agent/dating/T-0035-producteur-embeddings
worktree: ../worktrees/T-0035
pr: ""
notes: "Récupère le producteur du worktree v1-dating : le schéma et la logique métier (slugs fermés, déclencheurs) sont conservés ; l'outbox est réécrite sur le modèle canonique ADR 0007 (enveloppe complète, publication par lot, disponibilité croissante)."
---

## Objectif

Un changement de questionnaire produit la demande de calcul des vecteurs de rencontre (`dating.embedding_requested` v1) de façon fiable : écrite dans la même transaction que le profil, jamais perdue si le bus tombe, jamais dupliquée au rejeu — l'IA pratique la sortie au moyen de `type:id`.

## Contexte et règles métier

- `docs/domain/dating.md` : les réponses du questionnaire sont fermées (slugs, notes 1–5) — le payload ne contient aucun texte libre.
- L'événement n'est émis que si `questionnaire_v` ou `answers` changent (comparaison canonique, indépendante de l'ordre des clés) ; un profil sans signal (un bloc vide) n'émet rien.
- ADR 0007 : l'enveloppe complète est stockée en colonne `envelope`, la publication est **par lot**, un rollback métier ne produit rien.

## À livrer

1. Migration `db/migrations/dating/202610291100_outbox.sql` : `dating_outbox` au schéma canonique (`id`, `envelope` jsonb, `status`, `attempts`, `available_at`, `last_error`) + `dating_inbox` pour les futurs consommateurs du domaine.
2. Code : `DatingOutboxService` (`enqueue(trx, envelope)` dans la transaction métier, `relay(limit)` par lot avec repli par ligne pour une enveloppe invalide, référence `available_at` croissante 2^n minutes plafonnée à 15) ; branchement dans `DatingService.putProfile`, planificateur interne (`DATING_CRON_*`) et `POST /internal/dating/outbox/relay` (rôle `service`).
3. Schéma producteur `packages/events/src/dating/` + `services/dating/src/embedding-request.ts` : co-signature du contrat v1 gelé côté `ai` (aucune divergence de sémantique).
4. Tests : unitaires sur le schéma et les déclencheurs, test d'intégration opt-in PostgreSQL (`DATING_TEST_DATABASE_URL`) sur l'atomicité (rollback ne produit rien), l'émission unique par changement, le relais en échec puis repris.

## Critères d'acceptation

- [ ] aucune publication directe au bus depuis `DatingService` (tout passe par l'outbox)
- [ ] la transaction métier et l'écriture d'outbox sont atomiques
- [ ] rejeu d'un événement avec le même `id` côté consommateur
- [ ] un échec de bus laisse la ligne `pending`, `attempts` incrémenté, erreur lisible
- [ ] aucune fuite de PII dans le payload (garde `assertNoPii`)

## Hors périmètre

RabbitMQ réel, consommation des vecteurs, classement cosinus des propositions, crédits restaurant.

## Preuves attendues dans la PR

Test d'intégration atomicité + reprise, extrait de `dating_outbox` avant et après relais.
