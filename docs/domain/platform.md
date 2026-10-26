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
| `docker compose -f deploy/compose.dev.yaml up -d` | disponible (PostgreSQL pgvector, Redis, RabbitMQ) | v1/socle |
| `pnpm db:migrate <schema>` | disponible (`tools/db-migrate.mjs`, `DATABASE_URL` requis) | v1/socle |
| `pnpm dev:infra` / `pnpm dev:reset` / `pnpm dev:down` | **à créer** | F0.2 |
| `pnpm dev` | déclarée (`turbo run dev --parallel`), sans paquet à lancer pour l'instant | F0.2/F0.5 |
| `pnpm test:integration` | **à créer** | F0.5 |
| `pnpm db:migrate` / `pnpm db:codegen` | **à créer** | F0.5 |
| `pnpm gen:contracts` | **à créer** | F0.4 |
| `pnpm gen:registry` | **à créer** | F0.7 |
| `pnpm new:service` | **à créer** | F0.5 |
| `pnpm tools:check-ownership` | **à créer** | F0.3 |

Ne pas créer un script bidon pour une commande « à créer » : elle appartient à la tâche indiquée.

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
