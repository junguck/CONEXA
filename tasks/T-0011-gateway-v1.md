---
id: T-0011
title: "Gateway v1 : routage par manifestes, JWT, limites de débit"
feature: F0.8
agent: gateway
status: todo
depends_on: [T-0010]
size: M
owned_paths:
  - services/gateway/**
  - docs/domain/gateway.md
reads:
  - docs/product/API.md#1-conventions
  - docs/product/API.md#9-routage-par-microservice
  - docs/product/ARCHITECTURE.md#5-communication
  - packages/service-kit/src/auth.ts
contracts_touched: []
deps_request: []
human_gate: false
reviewers: [architect, security]
branch: ""
worktree: ""
pr: ""
notes: "Branche v1/gateway, dérivée de v1/socle. Le rate limit utilise Redis quand REDIS_URL est présent, sinon un compteur en mémoire (tests)."
---

## Objectif

Un point d'entrée unique : route selon les manifestes des services, vérifie les JWT RS256, limite le débit, normalise les erreurs, sans logique métier.

## À livrer

1. Chargement des `services/*/gateway.routes.json` (base_path, upstream, routes, auth).
2. Proxy HTTP (streaming du corps, en-têtes `X-Request-Id` et `traceparent` propagés, `x-user-id` et `x-user-roles` ajoutés après vérification).
3. Vérification JWT (JWKS ou clé publique), routes publiques, blocage `/internal/*`.
4. Limites de débit : 120/min/utilisateur, 10/min sur `/auth/*`, réponse `429` au format d'erreur avec `Retry-After`.
5. `/health`, `/ready`, `docs/domain/gateway.md`.

## Critères d'acceptation

- [ ] un manifeste de service suffit à router un nouveau préfixe, sans modifier le gateway
- [ ] jeton absent ou invalide sur une route protégée → `401 UNAUTHENTICATED`
- [ ] `/internal/*` renvoie `403` même avec un jeton valide
- [ ] au-delà de la limite → `429 RATE_LIMITED` + `Retry-After`
- [ ] tests de routage, d'authentification et de limite verts

## Hors périmètre

Émission des jetons (Identity), agrégation BFF, WebSocket (realtime non inclus).

## Preuves attendues dans la PR

Sortie des tests, exemple de requête proxifiée vers un service local.
