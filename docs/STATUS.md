# État du projet

Mis à jour : **2026-10-26** (intégration v1). Tenu par l'orchestrateur ; toute instance le lit avant de choisir une tâche.

## En un mot

Le cadre de pilotage, le monorepo et la **vague v1 des services** sont intégrés sur la branche `v1/integration` : socle partagé, Gateway, Identity, Football, Dating, Talents, Marketplace, plus un service **uploads** qui débloque les `upload_id` déjà présents dans les contrats. Les sept branches d'origine sont fusionnées et vérifiées ensemble. Les migrations restent reconstituées faute de `schema.sql` (ADR 0003, à valider).

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

## Vague v1 : six services (branches à fusionner)

Chaque branche part de `v1/socle`. **Fusionner `v1/socle` en premier**, puis les services dans l'ordre de dépendance des lectures (Gateway ne dépend d'aucun schéma ; Identity avant Football/Dating).

| Branche | Contenu | Tâche | Statut |
|---|---|---|---|
| `v1/socle` | Contrats, erreurs, événements, kit de service, gabarit, runner de migrations, compose dev | T-0010 | fusionné dans `v1/integration` |
| `v1/gateway` | Routage par manifestes, JWT/JWKS, limites de débit, `/internal/*` bloqué | T-0011 | fusionné dans `v1/integration` |
| `v1/identity` | OTP haché, JWT RS256 + rotation, profil, validation admin, fiabilité, contact interne | T-0012 | fusionné dans `v1/integration` |
| `v1/football` | Équipes, défis, matchs, Elo, classements | T-0013 | fusionné dans `v1/integration` |
| `v1/dating` | Profil, picks, quotas, dates par cartes, annulation 3 h, révélation du contact | T-0014 | fusionné dans `v1/integration` |
| `v1/talents` | Compétences, publications, missions, avis, événements | T-0015 | fusionné dans `v1/integration` |
| `v1/marketplace` | Offres à formules, commandes et machine à états, révisions, litiges | T-0016 | fusionné dans `v1/integration` |
| `v1/integration` | Service **uploads** (photos, logos, preuves, portfolios), seed de démo, parcours e2e | T-0017 | review |

**Non couvert en v1** (assumé, voir ADR 0003) : paiements et séquestre réels, facturation, temps réel et chat, worker IA et `pgvector`, portail partenaire, écrans. Les services concernés passent par des interfaces (`PaymentsGateway`, `EntitlementsGateway`) avec des doubles.

## Intégration v1 : ce qui a été vérifié ensemble

La fusion des sept branches a révélé trois défauts qu'aucune branche seule ne pouvait voir ; ils sont corrigés et couverts :

1. **Identity ne démarrait pas.** `IdentityService` déclarait ses dépendances en paramètres de constructeur avec valeur par défaut ; Nest les traitait comme des providers inexistants et sortait en code 1 sans message (journalisation Nest désactivée). Les dépendances sont devenues des champs.
2. **Gateway ne retirait pas le préfixe public.** `/football/teams` était transmis tel quel au service monté sur `/teams` → 404. `upstreamPathFor()` retire `base_path` et est testé.
3. **`birth_date` sortait en objet `Date`.** `GET /me` échouait à la validation du contrat (`expected string, received Date`) ; la date est désormais sérialisée en ISO.

Vérifications faites sur un PostgreSQL 18 réel, six services et Gateway démarrés :

| Preuve | Commande |
|---|---|
| Lint, types, tests, build, docs | `pnpm verify` (vert) |
| Migrations des six schémas | `node tools/db-migrate.mjs <schéma>` |
| Données de démo (3 comptes, 1 équipe, 1 offre) | `node tools/seed-demo.mjs` |
| OTP → JWT → Gateway → Football, upload complet, contact interne | `node tests/e2e/v1-smoke.mjs` (18 vérifications) |
| Toutes les routes protégées des six services | appel réel par la Gateway avec un jeton |

**Reste à faire pour un pilote** : payer réellement (Payments/Campay, Billing), messagerie et notifications, crons de clôture (validation 72 h, contestation 48 h, vote MVP), back-office des litiges et validations, pilote de stockage S3 pour les uploads, écrans branchés sur les contrats.

## Blocages et décisions attendues (ne pas coder autour)

1. **`docs/product/schema.sql` manquant** — les migrations v1 sont reconstituées et **à valider** ([ADR 0003](decisions/0003-schema-base-reconstitue.md)) ; le fichier d'origine reste attendu pour comparer table par table.
2. **`docs/product/README.md` (README produit) manquant** — cité §4, §5, §6, §8, §12, §16 ; T-0007 peut démarrer sur les maquettes mais doit signaler le manque.
3. **`pgvector` non disponible en local (Windows)** — la v1 stocke un emplacement `jsonb` marqué À VALIDER ; activer `vector(64)` et le worker IA avant F4.3 en production.
4. **Jest → Vitest** — NestJS 12 est ESM-only ; ADR 0004 à valider et `docs/STACK.md` §2 à corriger.
5. **Domaine** : `api.convexa.app` est une hypothèse d'attente ([ADR 0001](decisions/0001-marque-convexa.md)). Le domaine réel est une tâche humaine de la roadmap.
6. **Campay** : webhook, frais, remboursement natif, prélèvement récurrent restent non confirmés (`docs/STACK.md` §3.2) — à trancher avant F3.2.
7. **OTP WhatsApp** : fournisseur non choisi — ADR avant F1.1 en production.
8. **Grand livre à simple écriture** dans le schéma d'origine : ADR « double écriture » validée par un humain avant F3.1.
9. **Protection de `main` sur GitHub** : à activer par l'humain (PR obligatoire, CI verte, squash). Tant qu'elle est absente, la discipline est humaine : ne pas pousser sur `main` hors bootstrap.
10. **`schema_extension.sql` n'a jamais tourné** sur un vrai PostgreSQL : premier travail d'intégration dès que F0.2 existe. _(Fait pour les six schémas v1 : les migrations ont été appliquées sur un PostgreSQL 18 réel ; le fichier d'origine reste attendu pour comparer.)_
11. **Stockage des fichiers** : le service uploads écrit sur disque local en développement ; le fournisseur S3-compatible (R2, Scaleway, MinIO) et la sauvegarde restent à choisir avant toute mise en ligne.
12. **Argent réel** : `FakePaymentsGateway` et `FixedEntitlementsGateway` sont des doubles assumés ; aucun encaissement, séquestre, remboursement ni abonnement n'est réellement possible avant F3.1 à F3.4.

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

1. Brancher le front sur les contrats publiés (`@conexa/contracts`) : ils sont la seule interface stable.
2. Argent : Payments (grand livre à double écriture), Campay, séquestre et Billing — chemin critique des rencontres (F3.1 à F3.4).
3. Messagerie temps réel, notifications, crons de clôture et back-office (litiges, modération, validations).
4. Uploads en production : choisir le stockage S3-compatible et la politique de sauvegarde.
5. Vague 0 restante : Docker/CI (T-0002, T-0003), observabilité (T-0006), design system (T-0007) ; `schema.sql` attendu pour valider l'ADR 0003.
