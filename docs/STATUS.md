# État du projet

Mis à jour : **2026-10-26** (session d'initialisation). Tenu par l'orchestrateur ; toute instance le lit avant de choisir une tâche.

## En un mot

Le dépôt est **initialisé** : cadre de pilotage multi-agents, sources produit copiées, monorepo pnpm + Turborepo vide avec son outillage qualité. **Aucun service, aucune app, aucune migration** — le code produit commence à la vague 0, après le signal humain.

## Ce qui est en place

| Élément | État |
|---|---|
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `agents/` (16 agents, ownership, prompts, workflow git) | en place |
| `docs/ROADMAP.md` (53 fonctionnalités), `docs/STACK.md`, `tasks/_TEMPLATE.md` | en place |
| `docs/product/` : `API.md`, `ARCHITECTURE.md`, `schema_extension.sql`, `design/` (maquettes) | en place |
| `docs/decisions/` : modèle d'ADR, ADR 0001 (marque Convexa), ADR 0002 (sources manquantes) | en place |
| Outils : `tools/verify-docs.py`, `tools/gen-agent-ownership.py` | en place, verts |
| F0.1 : `package.json`, `pnpm-workspace.yaml`, `turbo.json`, presets `@conexa/config`, ESLint/Prettier/commitlint/lefthook, `.nvmrc` | fait (T-0001) |
| Vérifications | `pnpm install`, `turbo run lint typecheck test build` (cache), `pnpm docs:verify` : verts |

## Vague 0 : tâches

| Tâche | Fonctionnalité | Agent | Dépend de | Statut |
|---|---|---|---|---|
| [T-0001](../tasks/T-0001-monorepo-pnpm-turborepo.md) | F0.1 Monorepo et outillage | platform | — | **done** |
| [T-0002](../tasks/T-0002-environnement-dev-docker-compose.md) | F0.2 Docker Compose de développement | platform | T-0001 | todo |
| [T-0003](../tasks/T-0003-ci-et-garde-fous.md) | F0.3 CI et garde-fous | platform | T-0001 | todo |
| [T-0004](../tasks/T-0004-paquets-partages-contrats-evenements.md) | F0.4 Contrats, événements, messagerie, erreurs | architect | T-0001 | todo |
| [T-0005](../tasks/T-0005-gabarit-service-nestjs.md) | F0.5 Gabarit de service NestJS | architect | T-0002, T-0004 | todo |
| [T-0006](../tasks/T-0006-observabilite-de-base.md) | F0.6 Observabilité de base | platform | T-0002, T-0005 | todo |
| [T-0007](../tasks/T-0007-design-system-coquille-web-pwa.md) | F0.7 Design system et coquille PWA | web-core | T-0001 | todo |
| [T-0008](../tasks/T-0008-gateway-squelette.md) | F0.8 Gateway : squelette | gateway | T-0005 | todo |
| [T-0009](../tasks/T-0009-coquilles-backoffice-portail.md) | F0.9 Coquilles back-office et portail | web-core | T-0007 | todo |

**Démarrables tout de suite, chemins disjoints** : T-0002 (platform, `deploy/`), T-0003 (platform, `.github/` + `tools/`) — mais un seul agent par domaine à la fois, donc T-0002 **ou** T-0003 ; T-0004 (architect, `packages/`), T-0007 (web-core, `apps/web` + `packages/ui`). Plafond : 3 agents en parallèle.

**Conditions de démarrage** : T-0002 et T-0003 exigent `human-ok` (elles touchent `deploy/` et `.github/`) ; T-0004 est le contrat dont dépendent T-0005 et tous les services — le fusionner avant d'ouvrir du code métier.

## Blocages et décisions attendues (ne pas coder autour)

1. **`docs/product/schema.sql` manquant** — prérequis de `schema_extension.sql` et de toutes les tâches des vagues 1+. Voir [ADR 0002](decisions/0002-sources-produit-manquantes.md). Tâche qui le lit → `blocked`.
2. **`docs/product/README.md` (README produit) manquant** — cité §4, §5, §6, §8, §12, §16 ; T-0007 peut démarrer sur les maquettes mais doit signaler le manque.
3. **Domaine** : `api.convexa.app` est une hypothèse d'attente ([ADR 0001](decisions/0001-marque-convexa.md)). Le domaine réel est une tâche humaine de la roadmap.
4. **Campay** : webhook, frais, remboursement natif, prélèvement récurrent restent non confirmés (`docs/STACK.md` §3.2) — à trancher avant F3.2.
5. **OTP WhatsApp** : fournisseur non choisi — ADR avant F1.1 en production.
6. **Grand livre à simple écriture** dans le schéma d'origine : ADR « double écriture » validée par un humain avant F3.1.
7. **Protection de `main` sur GitHub** : à activer par l'humain (PR obligatoire, CI verte, squash). Tant qu'elle est absente, la discipline est humaine : ne pas pousser sur `main` hors bootstrap.
8. **`schema.sql` et `schema_extension.sql` n'ont jamais tourné** sur un vrai PostgreSQL : premier travail d'intégration dès que F0.2 existe.

## Protocole multi-instances (à lire avant de coder)

Une instance = une tâche = une branche = un worktree. **Personne ne travaille dans `CONEXA/` lui-même** : le répertoire principal reste sur `main`, propre, réservé à l'orchestrateur et à l'humain.

```bash
# 1. Réclamer la tâche (le statut est le verrou)
cd CONEXA
git fetch origin
git worktree add ../worktrees/T-0002 -b agent/platform/T-0002-compose-dev origin/main
cd ../worktrees/T-0002
pnpm install --frozen-lockfile
# dans le fichier de tâche : status: in_progress, branch, worktree
# puis commit "chore(tasks): claim T-0002" et push immédiat
```

- **Verrou** : si le push de la réclamation est refusé, la tâche est déjà prise — en choisir une autre, ne pas forcer.
- **Chemins** : n'écrire que dans `agent/ownership.yaml` **et** dans les `owned_paths` de la tâche. Un fichier d'un autre agent manque ? `status: blocked`, `notes: needs <agent>: <demande>`.
- **Contrat d'abord** : un endpoint ou un événement nouveau se publie avant d'être consommé.
- **Pas de `main`** : jamais de commit direct sur `main` hors bootstrap ; on pousse sa branche, l'orchestrateur (ou l'humain) fusionne.
- **Une seule tâche à la fois** par instance ; une seule instance par domaine à un instant donné.
- **Windows** : les chemins ci-dessus donnent `C:\Users\EG\Desktop\Conexa\worktrees\T-xxxx`. Chaque worktree a besoin de son `pnpm install`.
- **Clôture** : PR ouverte, CI verte, preuves jointes, statut `review`. Après fusion, `git worktree remove ../worktrees/T-0002`.

## Prochaines étapes

1. Signal humain pour ouvrir la vague 0 (T-0002/T-0003/T-0004/T-0007 en parallèle, 3 instances maximum).
2. Déposer `schema.sql` et le README produit dans `docs/product/` pour débloquer la vague 1.
3. Activer la protection de `main` et les étiquettes de revue sur GitHub.
