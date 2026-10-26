# Domaine : platform

Outillage, CI, Docker, observabilité. Propriétaire : agent `platform` (voir `agents/ownership.yaml`).

## Commandes du dépôt et leur état

`AGENTS.md` liste les commandes attendues par tous les agents. Elles arrivent par vagues ; ce tableau dit ce qui existe **aujourd'hui**.

| Commande | État | Créée par |
|---|---|---|
| `pnpm install` | disponible | F0.1 |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | disponible (Turborepo) | F0.1 |
| `pnpm turbo run lint typecheck test build [--filter=…]` | disponible | F0.1 |
| `pnpm format` / `pnpm format:check` | disponible (Prettier) | F0.1 |
| `pnpm docs:verify` | disponible (cohérence roadmap / prompts / propriété / liens) | F0.1 |
| `pnpm agents:ownership` | disponible (remplit la section Propriété des README d'agents) | F0.1 |
| `pnpm verify` | disponible (docs:verify + format:check + lint + typecheck + test + build) | F0.1 |
| `pnpm dev:infra` / `pnpm dev:reset` / `pnpm dev:down` | disponible (Compose de développement) | F0.2 |
| `pnpm test:db:isolation` | disponible (un rôle ne lit pas le schéma d'un autre service) | F0.2 |
| `pnpm dev` | déclarée (`turbo run dev --parallel`), sans paquet à lancer pour l'instant | F0.2/F0.5 |
| `pnpm test:integration` | **à créer** | F0.5 |
| `pnpm db:migrate` / `pnpm db:codegen` | **à créer** | F0.5 |
| `pnpm gen:contracts` | **à créer** | F0.4 |
| `pnpm gen:registry` | **à créer** | F0.7 |
| `pnpm new:service` | **à créer** | F0.5 |
| `pnpm tools:check-ownership` | **à créer** | F0.3 |

Ne pas créer un script bidon pour une commande « à créer » : elle appartient à la tâche indiquée.

## Infrastructure de développement (F0.2)

`pnpm dev:infra` démarre PostgreSQL + pgvector, Redis, RabbitMQ, MinIO et le collecteur OpenTelemetry, puis attend que les vérifications de santé passent (`up -d --wait`). `pnpm dev:down` arrête sans perdre les volumes ; `pnpm dev:reset` supprime les volumes et repart d'une base vide.

| Service | Image | Ports | Profil |
|---|---|---|---|
| PostgreSQL + pgvector | `pgvector/pgvector:pg17` | 5432 | `core` |
| Redis | `redis:7-alpine` | 6379 | `core` |
| RabbitMQ | `rabbitmq:4-management-alpine` | 5672, 15672 | `core` |
| MinIO | `minio/minio:latest` | 9000, 9001 | `storage` |
| Collecteur OTel | `otel/opentelemetry-collector-contrib` | 4317, 4318, 13133 | `observability` |

- **Un schéma et un rôle par service** (`identity`, `football`, `dating`, `talents`, `marketplace`, `partners`, `payments`, `billing`, `messaging`) : le script [10-schemas-roles.sh](../../deploy/postgres/init/10-schemas-roles.sh) crée le rôle, le schéma dont il est propriétaire, révoque `PUBLIC`, active `vector` et fixe son `search_path`. Aucun rôle n'a `USAGE` ni `CREATE` sur le schéma d'un autre.
- **Test d'isolation** : `pnpm test:db:isolation` crée une table dans `football` avec `conexa_football`, puis vérifie que les huit autres rôles ne peuvent ni la lire ni écrire dans le schéma. Il exige `pnpm dev:infra`.
- **Configuration** : uniquement des variables d'environnement (`.env.example`) ; l'état vit dans les volumes nommés `postgres-data`, `redis-data`, `rabbitmq-data`, `minio-data`. Aucune variable obligatoire hors d'un `.env` local ; les valeurs livrées sont des mots de passe de développement.
- **Observabilité** : les services exportent en OTLP vers `localhost:4317`/`4318` ; le collecteur écrit en clair pour l'instant, les tableaux de bord arrivent avec F0.6.
- **Prérequis** : Docker Desktop (ou Docker Engine + Compose v2) démarré. `pnpm dev:infra` vise un démarrage à froid sous deux minutes et échoue si un service ne devient pas sain.

## Conventions posées par F0.1

- **Node LTS 22** (`.nvmrc`), **pnpm 12** épinglé par `packageManager`, versions exactes (`saveExact`).
- **Un paquet = un `package.json` + ses scripts `lint`, `typecheck`, `test`, `build`** ; Turborepo orchestre, et n'exécute une tâche que là où elle est définie.
- **Presets partagés** dans `@conexa/config` : `tsconfig/base.json`, `tsconfig/library.json`, `eslint/base.mjs`. Un nouveau paquet écrit son `eslint.config.mjs` avec `export { default } from '@conexa/config/eslint/base';` et étend `@conexa/config/tsconfig/library.json`.
- **Prettier** ne formate pas les documents de pilotage (`*.md`, `docs/`, `agents/`, `tasks/`) : leurs tableaux et blocs de prompt sont mis en forme à la main.
- **Commits** : Conventional Commits (commitlint), portée = domaine, pied `Task: T-xxxx`. Les hooks lefthook s'installent localement avec `pnpm exec lefthook install` (le postinstall de pnpm les synchronise déjà sur ce poste).
- **Pas d'accès au registre depuis la CI sans lockfile** : `pnpm install --frozen-lockfile` partout.

## Pièges connus

- **Windows** : les outils Python doivent lire et écrire en UTF-8 explicite (les défauts de la locale cassent les accents et les caractères `·`/`—` des documents). Corrigé dans `tools/*.py` le 2026-10-26.
- **pnpm 12** : `onlyBuiltDependencies` n'existe plus, c'est `allowBuilds` dans `pnpm-workspace.yaml`. Un `allowBuilds` dupliqué fait échouer la lecture du fichier.
- **Turborepo** : ne déclarer `outputs` que si la tâche produit réellement ces fichiers, sinon chaque exécution affiche un avertissement.
