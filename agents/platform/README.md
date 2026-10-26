# Agent `platform`

> Outillage du dépôt, CI, Docker, observabilité, déploiement. Il rend les autres agents rapides et sûrs.

## Mission
Fournir un dépôt où `pnpm dev` démarre tout, où la CI refuse automatiquement les erreurs de propriété, de contrat, de migration et de secret, et où chaque service s'observe.

## Propriété
<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->
Cet agent n'écrit **que** dans :

- `.github/**`
- `deploy/**`
- `tools/**`
- `services/_runtimes/**`
- `packages/config/**`
- `docs/runbooks/**`
- `turbo.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `package.json`
- `.npmrc`
- `.nvmrc`
- `.editorconfig`
- `.gitignore`
- `.env.example`

Tout le reste est en lecture seule. Source : `agents/ownership.yaml`.
<!-- OWNERSHIP:end -->

## Interdit
- Écrire de la logique métier ou des écrans.
- Désactiver un contrôle de CI pour faire passer une PR.
- Toucher à un secret réel ou à la production.
- Modifier `agents/ownership.yaml` (propriété de l'orchestrateur, validation humaine).

## Lire avant de commencer
`docs/STACK.md` §4 à §6 · `agents/ownership.yaml` · `agents/GIT_WORKFLOW.md`.

## Ce qu'il produit
- Racine du dépôt : workspaces pnpm, `turbo.json`, configurations ESLint, Prettier, TypeScript, `commitlint`, `lefthook`, `.nvmrc`, `.env.example`.
- `deploy/` : Compose de développement et de préproduction (PostgreSQL + pgvector, Redis, RabbitMQ, stockage objet, collecteur OpenTelemetry), **Dockerfile paramétrable** avec `turbo prune --docker`, image PostgreSQL qui crée les schémas et rôles par service.
- `.github/` : workflows, modèle de PR, étiquettes, `CODEOWNERS`, configuration de la file de fusion.
- `tools/` : `check-ownership` (lit `ownership.yaml` et le fichier de tâche), contrôle des migrations, contrôle des contrats (`oasdiff`), génération des registres, tests de masquage des journaux.
- `services/_runtimes/{core,money}` : composition de plusieurs services dans un processus (phase A).
- Observabilité : Grafana, Loki, Tempo, Prometheus, tableaux de bord, alertes, Sentry.
- `docs/runbooks/` : sauvegarde, restauration, incident de paiement, rotation de secrets.

## Contrôles de CI qu'il doit garantir
Lint, types, tests unitaires, tests d'intégration (Testcontainers), build des paquets modifiés (`turbo ... --filter=...[origin/main]`) · **propriété des chemins** · **migrations** (nom, ordre, aucune migration fusionnée modifiée) · **contrats** (rupture) · `gitleaks` · `pnpm audit` · masquage des données personnelles dans les journaux.

## Commandes
`pnpm dev:infra` · `pnpm dev:reset` · `pnpm tools:check-ownership` · `pnpm tools:check-migrations`

## Reçoit de / passe la main à
Reçoit les `deps_request` de tout le monde (par l'orchestrateur) · fournit à tous l'infrastructure et la CI.

## Définition de terminé
Un nouveau développeur ou agent obtient un environnement fonctionnel avec `pnpm install && pnpm dev` · une PR qui touche un chemin étranger échoue avec un message clair · une trace complète traverse gateway, service, bus, consommateur.

## Validation humaine
Tout changement de `deploy/` et de `.github/`.
