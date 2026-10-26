---
id: T-0008
title: "Gateway : squelette"
feature: F0.8
agent: gateway
status: todo
depends_on: [T-0005]
size: M
owned_paths:
  - services/gateway/**
  - docs/domain/gateway.md
reads:
  - docs/product/API.md#1-conventions
  - docs/product/API.md#9-routage-par-microservice
  - docs/product/ARCHITECTURE.md#5-communication
  - tasks/T-0005-gabarit-service-nestjs.md
contracts_touched: []
deps_request: []
human_gate: false
reviewers: [architect, security]
branch: ""
worktree: ""
pr: ""
notes: "Ne pas démarrer avant la fusion de T-0005 (gabarit) : le gateway doit être routé par manifestes, sans fichier central à éditer. L'émission des jetons appartient à identity (F1.1) ; ici on ne fait que vérifier par JWKS avec des clés de test."
---

## Objectif

Le point d'entrée unique : proxy, vérification JWT, limites de débit, normalisation des erreurs, sans aucune logique métier.

## Contexte et règles métier

`docs/product/API.md` §1 : 120 req/min/utilisateur, 10 req/min sur `/auth/*`, 30 messages/min en chat, format d'erreur unique avec `request_id`. `docs/product/ARCHITECTURE.md` : états de compte (`pending`, `suspended`, `banned`) et routes autorisées.

## À livrer

1. `services/gateway` (NestJS) : découverte des `services/*/gateway.routes.json`, proxy, vérification JWT RS256 par JWKS avec cache et rotation, limitation de débit Redis, `X-Request-Id` et `traceparent`, normalisation des erreurs, CORS, helmet, blocage `/internal/*`, proxy WebSocket vers realtime.
2. Tests : routage d'un service généré, jetons expiré/invalide, dépassement de débit, `/internal/*`.
3. `docs/domain/gateway.md`.

## Critères d'acceptation

- [ ] un service généré est routé sans modifier le code du gateway
- [ ] jeton expiré ou invalide → `UNAUTHENTICATED`
- [ ] `/internal/*` inaccessible depuis l'extérieur
- [ ] dépassement de débit → `429` au format d'erreur, avec `Retry-After`

## Hors périmètre

Émission ou rotation des jetons (identity), logique métier, accès base de données.

## Preuves attendues dans la PR

Sortie des tests, exemple de requête routée, manifeste d'un service ajouté sans diff sur le gateway.
