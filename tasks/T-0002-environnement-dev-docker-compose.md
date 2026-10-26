---
id: T-0002
title: "Environnement de développement Docker Compose"
feature: F0.2
agent: platform
status: review
depends_on: [T-0001]
size: M
owned_paths:
  - deploy/**
  - .env.example
  - package.json
  - docs/domain/platform.md
reads:
  - docs/STACK.md#5-docker-et-kubernetes-en-perspective
  - docs/product/ARCHITECTURE.md#3-diagramme
  - tasks/T-0001-monorepo-pnpm-turborepo.md
contracts_touched: []
deps_request: []
human_gate: true
reviewers: [security]
branch: "agent/platform/T-0002-compose-dev"
worktree: "C:\\Users\\EG\\Desktop\\Conexa\\worktrees\\T-0002"
pr: "https://github.com/junguck/CONEXA/pull/4"
notes: "Validation humaine obligatoire : tout changement dans deploy/. Aucune clé Campay réelle, mots de passe de développement uniquement dans .env.example. Vérifié : compose config, init sur PostgreSQL 18 réel, test d'isolation (8 rôles bloqués), pnpm verify. Docker Desktop indisponible sur le poste (HypervisorPresent=false) : pnpm dev:infra, docker compose ps et le démarrage à froid restent à mesurer sur un poste Docker avant fusion."
---

## Objectif

`pnpm dev:infra` démarre toute l'infrastructure locale en une commande : PostgreSQL + pgvector, Redis, RabbitMQ, MinIO, collecteur OpenTelemetry.

## Contexte et règles métier

`docs/product/ARCHITECTURE.md` §1 : un service = un domaine = un schéma PostgreSQL, aucun accès croisé entre schémas. `docs/STACK.md` §5 : configuration par variables d'environnement uniquement, aucun état sur le disque local en dehors des volumes nommés.

## À livrer

1. `deploy/compose.dev.yaml` : PostgreSQL (image pgvector officielle), Redis, RabbitMQ (interface de gestion), MinIO compatible S3, collecteur OpenTelemetry, profils et vérifications de santé.
2. Script d'initialisation PostgreSQL : un schéma **et** un rôle par service (`identity`, `football`, `dating`, `talents`, `marketplace`, `partners`, `payments`, `billing`, `messaging`), droits limités à son schéma, extension `vector` activée.
3. Scripts racine `dev:infra`, `dev:reset`, `dev:down` ; variables ajoutées dans `.env.example`.
4. `docs/domain/platform.md` mis à jour (commandes, ports, procédure de remise à zéro).

## Critères d'acceptation

- [ ] démarrage à froid < 2 min avec tous les services `healthy`
- [ ] un test prouve qu'un rôle ne peut pas lire le schéma d'un autre service
- [ ] `pnpm dev:reset` repart d'une base vide sans intervention manuelle
- [ ] aucune valeur secrète réelle dans `deploy/` ni dans `.env.example`

## Hors périmètre

Dockerfile des services (T-0005), observabilité complète (T-0006), préproduction (F6.4).

## Preuves attendues dans la PR

Sortie de `docker compose ps` (tous `healthy`), sortie du test d'isolation des rôles, durée du démarrage à froid mesurée.
