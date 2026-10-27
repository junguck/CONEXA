# Convexa

Convexa est une super-app de campus qui rassemble plusieurs services pour les
étudiants : football, rencontres, talents, services entre étudiants et offres
de partenaires. Le projet est organisé en monorepo `pnpm` + Turborepo et
développé avec un processus qui associe agents spécialisés et supervision
humaine.

> **État du projet :** consultez [`docs/STATUS.md`](docs/STATUS.md) pour connaître
> l'avancement réel, les tâches en cours et les blocages. La feuille de route
> décrit la cible ; une fonctionnalité n'est livrée que lorsqu'elle est
> implémentée, vérifiée et intégrée à `main`.

## Par où commencer ?

| Besoin | Document |
|---|---|
| Comprendre les étapes et fonctionnalités prévues | [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| Voir l'avancement, les blocages et les prochaines étapes | [`docs/STATUS.md`](docs/STATUS.md) |
| Comprendre l'architecture et les règles produit | [`docs/product/ARCHITECTURE.md`](docs/product/ARCHITECTURE.md), [`docs/product/API.md`](docs/product/API.md) |
| Consulter les tâches détaillées et leurs critères d'acceptation | [`tasks/`](tasks/) |
| Comprendre la stack technique | [`docs/STACK.md`](docs/STACK.md) |
| Découvrir les rôles et règles de collaboration des agents | [`agents/README.md`](agents/README.md) |
| Consulter les responsabilités par agent | [`agents/`](agents/) et [`agents/ownership.yaml`](agents/ownership.yaml) |

## Organisation du dépôt

| Dossier | Contenu |
|---|---|
| `apps/` | Applications destinées aux utilisateurs |
| `services/` | Services backend et traitements asynchrones |
| `packages/` | Paquets partagés et configuration |
| `db/migrations/` | Migrations de base de données |
| `docs/` | Roadmap, architecture, décisions, documentation produit et exploitation |
| `agents/` | Fiches de rôle, règles de collaboration et prompts |
| `tasks/` | Tâches découpées, dépendances et critères de validation |
| `tests/` | Tests transverses et de bout en bout |
| `tools/` | Outils de vérification et de génération |

## Prérequis

- Node.js `>=22` (version du projet dans [`.nvmrc`](.nvmrc))
- pnpm `12.4.1` (déclaré dans [`package.json`](package.json))
- Python 3 pour les outils de vérification documentaire

Activez la version de Node indiquée par `.nvmrc`, puis installez les dépendances
depuis la racine du dépôt :

```bash
pnpm install
```

## Commandes utiles

```bash
pnpm verify       # documentation, format, lint, types, tests et build
pnpm docs:verify  # cohérence de la roadmap, des prompts et des agents
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# Base de données locale : migrations par schéma, puis données de démonstration
DATABASE_URL=postgres://conexa:conexa_dev@localhost:5432/conexa pnpm db:migrate identity
DATABASE_URL=postgres://conexa:conexa_dev@localhost:5432/conexa pnpm seed:demo

# Parcours de bout en bout (services et Gateway démarrés)
pnpm test:e2e
```

`pnpm dev` lance les applications et services du workspace qui disposent d'une
commande de développement. Consultez [`docs/STATUS.md`](docs/STATUS.md) pour
vérifier ce qui est effectivement disponible dans la version courante de `main`.

## Contributions et travail des agents

Chaque tâche est décrite dans `tasks/` et précise ses dépendances, ses chemins
autorisés et ses preuves attendues. Le travail suit le workflow documenté dans
[`agents/GIT_WORKFLOW.md`](agents/GIT_WORKFLOW.md) : une branche et un worktree
par tâche, respect de la propriété des fichiers, puis vérifications et revue
avant intégration.

Les rôles sont détaillés dans [`agents/README.md`](agents/README.md) et dans les
fiches individuelles sous `agents/`. Les agents ne remplacent pas la revue
humaine ni les validations requises pour les décisions produit et les
changements sensibles.
