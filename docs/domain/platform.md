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
| `docker compose -f deploy/compose.dev.yaml up -d` | disponible (PostgreSQL pgvector, Redis, RabbitMQ ; MinIO et OTel via les profils) | v1/socle |
| `pnpm db:migrate <schema>` | disponible (`tools/db-migrate.mjs`, `DATABASE_URL` requis) | v1/socle |
| `pnpm dev:infra` / `pnpm dev:reset` / `pnpm dev:down` | disponible (Compose de développement, tous profils) | F0.2 |
| `pnpm test:db:isolation` | disponible (un rôle ne lit pas le schéma d'un autre service) | F0.2 |
| `pnpm dev` | déclarée (`turbo run dev --parallel`), sans paquet à lancer pour l'instant | F0.2/F0.5 |
| `pnpm test:integration` | **à créer** | F0.5 |
| `pnpm db:migrate` / `pnpm db:codegen` | **à créer** | F0.5 |
| `pnpm gen:contracts` | **à créer** | F0.4 |
| `pnpm gen:registry` | **à créer** | F0.7 |
| `pnpm new:service` | **à créer** | F0.5 |
| `pnpm tools:check-ownership` | disponible (propriété des chemins) | F0.3 |
| `pnpm tools:check-migrations` | disponible (nom, ordre, immutabilité, danger) | F0.3 |
| `pnpm tools:check-contracts` | disponible (OpenAPI et schémas d'événements) | F0.3 |
| `pnpm tools:check-pii` / `pnpm tools:check-secrets` | disponible (gardes statiques) | F0.3 |
| `pnpm test:tools` / `pnpm ci:guards` | disponible (tests des outils / tous les gardes) | F0.3 |

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

## Services v1

- **ESM partout** (`"type": "module"`, compilation `NodeNext`) : NestJS 12 est publié en ESM, Jest ne le charge pas sur Node 22 — Vitest est utilisé, y compris pour les services (ADR 0004).
- **`@conexa/service-kit`** porte la config, la base, le JWT, les erreurs, les logs et la santé ; un service ne fait que son domaine (ADR 0005).
- **Migrations** : `db/migrations/<schema>/*.sql`, appliquées par `tools/db-migrate.mjs`, enregistrées dans `<schema>._migrations`, en sens avant uniquement.
- **Un schéma par service** : la connexion Kysely est créée avec `withSchema(schema)`, aucune requête ne peut viser le schéma d'un autre service.

## Pièges connus

- **Windows** : les outils Python doivent lire et écrire en UTF-8 explicite (les défauts de la locale cassent les accents et les caractères `·`/`—` des documents). Corrigé dans `tools/*.py` le 2026-10-26.
- **pnpm 12** : `onlyBuiltDependencies` n'existe plus, c'est `allowBuilds` dans `pnpm-workspace.yaml`. Un `allowBuilds` dupliqué fait échouer la lecture du fichier.
- **Turborepo** : ne déclarer `outputs` que si la tâche produit réellement ces fichiers, sinon chaque exécution affiche un avertissement.
- **PostgreSQL local (Windows)** : lancer `postgres` au premier plan (`pg_ctl` détaché depuis Git Bash fait tomber les processus fils avec `0xC0000142`). Un cluster de travail suffit : `initdb -D .pgdata -U conexa --auth=trust`, puis `postgres -D .pgdata -p 55432`.
- **`pino-http`** est CommonJS avec double export : en ESM, importer `{ pinoHttp }`, pas le défaut.

## Garde-fous de CI (F0.3)

La CI (`.github/workflows/ci.yml`) refuse automatiquement une PR qui sort des chemins de son agent, modifie une migration fusionnée, casse un contrat, journalise une PII ou contient un secret. Les outils sont utilisables en local, sans Docker ni réseau.

| Outil | Ce qu'il refuse | Exception |
|---|---|---|
| `check-ownership` | un fichier hors de `ownership.yaml` et des `owned_paths` de la tâche ; un champ de tâche autre que `status`, `branch`, `worktree`, `pr`, `notes` | une tâche `blocked` documente la demande à l'agent propriétaire (règle 7) |
| `check-migrations` | un nom non horodaté, une migration fusionnée modifiée ou supprimée, un horodatage rétroactif, une migration destructrice | `ALLOW_DESTRUCTIVE=1` après `human-ok` |
| `check-contracts` | suppression de route, d'opération, de réponse, de champ, d'énumération ; changement de type ; champ devenu obligatoire | nouvelle version `…v2` |
| `check-pii-logs` | `logger`/`console` citant téléphone, WhatsApp, matricule, OTP, MoMo, jeton, mot de passe sans masquage | commentaire `pii-check: ignore` justifié en revue |
| `check-secrets` | clé privée, jeton AWS/GitHub/Slack/API, affectation de secret longue | `pragma: allowlist secret` ou `gitleaks:allow` |

- **Base de comparaison** : `origin/main` par défaut ; `--working-tree` inclut le travail non commité ; `--branch` force la branche (utile en CI ou après un rebase).
- **Résolution de la tâche** : `agent/<agent>/T-xxxx-…`, ou le champ `branch:` de la tâche pour les branches `v1/…`.
- **Propriété étendue** : les `owned_paths` de la tâche s'ajoutent aux chemins de l'agent, sinon un agent ne pourrait pas livrer une tranche verticale (écran + service + migration).
- **Secrets** : `check-secrets` couvre l'arbre de travail ; `gitleaks` (image épinglée) couvre tout l'historique et reste l'autorité. `pnpm audit --audit-level=high` bloque les vulnérabilités hautes.
- **CI** : `quality` (format, docs, commits conventionnels, lint/types/tests/build filtrés, intégration si définie, audit), `guards` (propriété, migrations, contrats), `privacy` (PII, secrets, gitleaks), `python-services` (worker IA quand `services/ai-worker/pyproject.toml` existe).
- **Étiquettes et revue** : `.github/labels.yml` synchronisé par `.github/workflows/labels.yml` ; `.github/CODEOWNERS` et le modèle de PR rappellent `human-ok`, `review:architect-ok`, `review:security-ok`, `review:qa-ok`.
- **`pnpm ci:guards`** enchaîne tous les gardes et leurs tests ; à lancer avant d'ouvrir une PR.
