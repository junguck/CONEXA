---
id: T-0001
title: "Squelette du monorepo pnpm + Turborepo et outillage qualité"
feature: F0.1
agent: platform
status: done
depends_on: []
size: S
owned_paths:
  - package.json
  - pnpm-workspace.yaml
  - pnpm-lock.yaml
  - turbo.json
  - .nvmrc
  - .editorconfig
  - .gitignore
  - .gitattributes
  - .env.example
  - eslint.config.mjs
  - .prettierrc.json
  - .prettierignore
  - commitlint.config.cjs
  - lefthook.yml
  - packages/config/**
  - docs/domain/platform.md
reads:
  - AGENTS.md
  - docs/STACK.md#4-structure-du-monorepo
  - docs/STACK.md#7-qualité-et-tests
  - agents/ownership.yaml
contracts_touched: []
deps_request: []
human_gate: false
reviewers: []
branch: "main (initialisation directe)"
worktree: ""
pr: ""
notes: "Exécutée par la session d'initialisation du 2026-10-26, avant l'ouverture du travail multi-agents. Aucun fichier de service ni d'app. Reste hors de cette tâche : CI (T-0003), Docker (T-0002), contrats (T-0004)."
---

## Objectif

Créer le squelette du monorepo et l'outillage qualité commun, pour que toutes les instances d'agent aient les mêmes commandes et le même formatage.

## Contexte et règles métier

`docs/STACK.md` §4 fixe l'arborescence, §7 les pratiques de test, §9 les règles d'ingénierie agentique (petits paquets, versions épinglées, aucun secret). Le dépôt est vide au départ : aucun code produit n'est créé ici.

## À livrer

1. Racine : `package.json` (scripts Turborepo, `packageManager` pnpm épinglé), `pnpm-workspace.yaml`, `turbo.json`.
2. Outillage : presets `@conexa/config` (`tsconfig/base.json`, `tsconfig/library.json`, `eslint/base.mjs`), ESLint (flat config) et Prettier partagés, commitlint, lefthook, `.nvmrc` Node 22, `.editorconfig`, `.gitattributes`.
3. Hygiène : `.gitignore`, `.env.example` sans secret.
4. Arborescence vide conforme : `apps/`, `services/`, `services/_runtimes/`, `packages/`, `db/migrations/`, `tests/e2e/`, `deploy/`.
5. `docs/domain/platform.md` : commandes existantes, celles qui restent à créer et par quelle tâche, pièges connus.

## Critères d'acceptation

- [x] `pnpm install` réussit à froid (postinstall lefthook inclus)
- [x] `pnpm turbo run lint typecheck test build` réussit sur le paquet d'exemple `@conexa/config`
- [x] un commit non conforme est refusé par commitlint (`wip: truc` → `type-enum`)
- [x] le cache Turbo est utilisé au deuxième passage (`4 cached`, `FULL TURBO`)
- [x] `pnpm docs:verify` passe (53 identifiants, 53 prompts, 16 agents, liens relatifs)

## Hors périmètre

Docker (T-0002), CI et garde-fous (T-0003), contrats (T-0004), gabarit de service (T-0005), tout écran et tout service.

## Preuves attendues dans la PR

Sorties de commandes ci-dessus. Cette tâche a été livrée directement sur `main` pour amorcer le dépôt, avant l'ouverture des PR.

## Preuves obtenues (2026-10-26)

```
$ pnpm install
Scope: all 2 workspace projects
.../lefthook@2.2.2/node_modules/lefthook postinstall: sync hooks: ✔️(pre-commit, commit-msg)
Done in 572ms using pnpm v12.4.1

$ pnpm turbo run lint typecheck test build
 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    84ms >>> FULL TURBO

$ echo "wip: truc" | pnpm exec commitlint
✖ type must be one of [build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test] [type-enum]

$ pnpm docs:verify
53 roadmap IDs, 53 prompts, 16 agents
ALL CHECKS PASSED
```
