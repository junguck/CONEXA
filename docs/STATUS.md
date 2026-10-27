# État du projet

Mis à jour : **2026-10-27**. Tenu par l'`orchestrator` ; toute instance le lit **avant** de choisir une tâche. Le tableau des tâches fait foi sur `tasks/`.

## En un mot

`main` (**c928ddb**) a la **CI verte** ([run #23](https://github.com/junguck/CONEXA/actions/runs/40546321487)) et contient les treize services v1, l'argent, le temps réel, les partenaires et le worker IA. **Le bus d'événements vient d'être fusionné** (T-0051) : les services peuvent enfin publier au-delà de leur processus, c'était le blocage n°1 des jalons J1 et J2. Le front reste **non fusionné** (trois branches `web-core` en vol) et **aucun écran n'est encore branché** sur l'API.

## Vérifié le 2026-10-27 (preuves)

| Vérification | Résultat |
|---|---|
| `pnpm turbo run lint typecheck test build --force` sur `main` | **76/76**, aucun cache, 1 min 56 |
| `pnpm install --frozen-lockfile` | 0 (lockfile cohérent) |
| `pnpm format:check`, `pnpm docs:verify` | verts |
| `pnpm audit --audit-level=high` | **0 vulnérabilité** (override `multer >= 2.5.0`) |
| `gitleaks detect --log-opts=--all` (v8.24.3, même image que la CI) | **0 fuite** |
| `python3 -m unittest discover -s tests` (`services/ai-worker`) | 59 tests |
| `pnpm ci:guards` (propriété, migrations, contrats, PII, secrets, outils) | vert |
| `pnpm docs:verify` (53 IDs de roadmap, 53 prompts, 16 agents) | vert |
| CI GitHub sur `c928ddb` | **success** (Qualité, PII et secrets, Services Python ; Garde-fous ignorés sur push, ils tournent en PR) |

## Ce qui vient d'être fusionné

| Tâche | Contenu | Commit |
|---|---|---|
| [T-0051](../tasks/T-0051-alignement-canonique.md) | **Bus d'événements** : `@conexa/errors` source unique du catalogue (le cycle avec `@conexa/contracts` disparaît), baril `@conexa/contracts` réunifié (primitives canoniques + contrats v1), `@conexa/events` (enveloppe, garde-fou PII, port **par lot**), `@conexa/event-messaging` (outbox transactionnelle, inbox idempotente, RabbitMQ), ADR **0007** | `ce942cd` |
| [T-0028](../tasks/T-0028-ci-verte-de-main.md) | CI : override `multer`, `.gitleaksignore`, `fetch-depth: 0` sur le scan d'historique | `162eac6`, `422090f`, `c928ddb` |

**Reste à faire sur ce socle** : brancher les producteurs sur l'outbox (football, identity, dating, marketplace, talents, partners, billing, payments) et les consommateurs sur l'inbox — tâche `architect` en cours de planification, elle débloque F2.4, F1.5 et toute la saga du date.

## Pistes parallèles en vol (ne pas recommencer)

| Branche | Agent | Contenu | Statut |
|---|---|---|---|
| `agent/web-core/T-0007-maquettes-complements` | web-core | `packages/ui`, `apps/web` (coquille PWA, 23 écrans maquettes, client API) | à fusionner |
| `agent/web-core/T-0009-backoffice-portal` | web-core | `apps/backoffice`, `apps/partner-portal` | à fusionner après T-0007 |
| `agent/architect/T-0004-shared-packages` | architect | **supersédée par T-0051** : à fermer sans fusionner | à clore |
| `integration/v1` | — | `services/ai` (TypeScript) en concurrence de `services/ai-worker` (Python) | **décision humaine** |
| worktree `v1-dating` (non commité) | dating | producteur `dating.embedding_requested` (outbox + schéma + test d'intégration) | **à récupérer** (moitié manquante du contrat IA) |

## Tâches

| Tâche | Fonctionnalité | Agent | Statut |
|---|---|---|---|
| [T-0001](../tasks/T-0001-monorepo-pnpm-turborepo.md) | F0.1 Monorepo | platform | **done** |
| [T-0002](../tasks/T-0002-environnement-dev-docker-compose.md) | F0.2 Compose dev | platform | **fusionnée** (clôturer) |
| [T-0003](../tasks/T-0003-ci-et-garde-fous.md) | F0.3 CI et gardes | platform | **fusionnée** (clôturer) |
| [T-0004](../tasks/T-0004-paquets-partages-contrats-evenements.md) | F0.4 Paquets partagés | architect | **supersédée par T-0051** |
| [T-0005](../tasks/T-0005-gabarit-service-nestjs.md) | F0.5 Gabarit | architect | todo (livré via v1 ; `pnpm new:service` manque) |
| [T-0006](../tasks/T-0006-observabilite-de-base.md) | F0.6 Observabilité | platform | **fusionnée** (clôturer) |
| [T-0007](../tasks/T-0007-design-system-coquille-web-pwa.md) | F0.7 Design system + PWA | web-core | in vol |
| [T-0008](../tasks/T-0008-gateway-squelette.md) | F0.8 Gateway | gateway | todo (livré via T-0011) |
| [T-0009](../tasks/T-0009-coquilles-backoffice-portail.md) | F0.9 Consoles | web-core | in vol |
| [T-0010](../tasks/T-0010-socle-v1-services.md) | Socle v1 | architect | fusionné dans `main` |
| [T-0011](../tasks/T-0011-gateway-v1.md) … [T-0016](../tasks/T-0016-marketplace-v1.md) | Six services v1 | gateway…marketplace | fusionnés dans `main` |
| [T-0017](../tasks/T-0017-service-uploads.md) | Fichiers | platform | fusionné dans `main` |
| [T-0018](../tasks/T-0018-worker-ia-vecteurs-rencontres.md) | Worker IA | ai | fusionné dans `main` |
| [T-0051](../tasks/T-0051-alignement-canonique.md) | F0.4 Bus d'événements | architect | **fusionné** (`ce942cd`) |
| [T-0028](../tasks/T-0028-ci-verte-de-main.md) | F0.3 CI verte | orchestrator | **fusionné** (`c928ddb`) |

**Numéros réservés** (ne pas les utiliser) : `T-0019` web-core (fusion du front) · `T-0020` à `T-0026` money (vague 3) · `T-0030` à `T-0034` football (litiges, clôtures, MVP, compétitions) · `T-0027`, `T-0029` architect/orchestrator.

## Chemin critique vers J1 puis J2

1. **Fusionner le front** (`T-0007` → `T-0009`) : sans `apps/`, aucun écran de J1 ni de J2 n'existe.
2. **Brancher l'outbox** : c'est ce qui fait vivre F2.4 (chat des capitaines), F1.5 (notifications) et la saga du date.
3. **J1** : arbitrage admin des litiges + crons de clôture (football) → e2e du parcours.
4. **J2** : Campay réel → reversements et rapprochement → entitlements partagés → saga de réservation (dating + partners) → écrans → durcissement.

## Blocages et décisions attendues (ne pas coder autour)

1. **Worker IA** : Python (livré) ou TypeScript (`services/ai`) ? — humain.
2. **Producteur d'embeddings de Dating** non commité dans le worktree `v1-dating` — à récupérer avant F4.3.
3. **`docs/product/schema.sql` manquant** : migrations v1 reconstituées, ADR 0003 à valider.
4. **Campay** : webhook, frais, remboursement, récurrent non confirmés (`docs/STACK.md` §3.2) — avant F3.2.
5. **Fournisseur d'OTP WhatsApp** : ADR avant F1.1 en production.
6. **Grand livre à double écriture** : ADR validé par un humain avant F3.1.
7. **Protection de `main`** : toujours absente sur GitHub (PR obligatoire, CI verte, squash).
8. **`CONEXA/` local sale** : `agents/ownership.yaml` et trois README d'agents sont modifiés non commités ; leur contenu est désormais **dans** `main` (T-0051) — après `git pull`, ces fichiers deviennent redondants.
9. **`.github/**` touché** (fetch-depth, CI) : validation humaine demandée et accordée par l'humain le 2026-10-27.

## Protocole multi-instances (à lire avant de coder)

Une instance = une tâche = une branche = un worktree. **Personne ne travaille dans `CONEXA/` lui-même** (reste sur `main`, propre, réservé à l'humain et à l'orchestrateur).

```bash
git worktree add ../worktrees/T-xxxx -b agent/<agent>/T-xxxx-<slug> origin/main
cd ../worktrees/T-xxxx && pnpm install
# tasks/T-xxxx-*.md : status: in_progress, branch, worktree, puis commit + push immédiat
```

- **Verrou** : si le push de la réclamation est refusé, la tâche est prise — change de tâche.
- **Chemins** : `agents/ownership.yaml` **et** les `owned_paths` de ta tâche. Un chemin d'autrui manque ? `status: blocked`, `notes: needs <agent>: <demande>`.
- **Pas de `main`** hors bootstrap : tu pousses ta branche, l'orchestrateur fusionne.
- **Deux échecs de CI sur la même cause** : tu t'arrêtes et tu expliques.
- **Hooks** : `lefthook` lance eslint sur les fichiers staged et commitlint au commit ; un script Node qui utilise `fetch` doit déclarer `/* global fetch */` en tête (convention du dépôt).

## Prochaines étapes

1. Fusionner `T-0007-maquettes-complements` puis `T-0009-backoffice-portal` (web-core).
2. Récupérer le producteur d'embeddings de Dating depuis le worktree `v1-dating`.
3. Brancher les producteurs sur l'outbox (architect) — **préalable à F2.4, F1.5, F4.5**.
4. Lancer les trois voies parallèles annoncées : web-core (front), money (vague 3), football (vague 2).
5. Arbitrer le doublon `services/ai` vs `services/ai-worker`.
