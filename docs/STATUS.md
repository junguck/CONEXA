# État du projet

Mis à jour : **2026-10-29** (fusion complète des branches). Tenu par l'orchestrateur ; toute instance le lit avant de choisir une tâche.

## En un mot

**Toutes les branches livrées sont fusionnées dans `main` et vérifiées ensemble.** Le monorepo contient désormais les seize services, les trois applications web, les huit paquets partagés et neuf ADR. Les sept branches de la piste v1, le service IA, les paiements Campay, l'arbitrage et les compétitions de football, les trois coquilles web et le design system sont dans `main`. Ce qui reste n'est plus du code à fusionner : ce sont des **décisions humaines** (section « Décisions humaines ») et des tâches neuves (T-0026, T-0035+).

## Ce qui est en place

| Élément | État |
|---|---|
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `agents/` (16 agents, ownership, prompts, workflow git) | en place |
| `docs/ROADMAP.md` (53 fonctionnalités), `docs/STACK.md`, `tasks/_TEMPLATE.md` | en place |
| `docs/product/` : `README.md` (produit), `API.md`, `ARCHITECTURE.md`, `schema_extension.sql` (source du schéma), `design/` (maquettes) | en place |
| `docs/decisions/` : ADR 0001 à 0010 | en place |
| `docs/vendor/` : `campay.md`, `mboasms.md` | en place |
| `legal/` : dossier juridique et liste des documents à produire | en place (à remplir par l'humain) |
| Outils : `tools/verify-docs.py`, `tools/check-*.py`, `gen-agent-ownership.py`, `db-migrate.mjs`, `seed-demo.mjs` | en place, verts |
| CI : `.github/workflows/ci.yml` (qualité, garde-fous, PII/secrets, services Python) | en place, verte |

### Services (`services/`, 16 paquets NestJS sauf `ai-worker`)

`gateway`, `identity`, `football`, `dating`, `talents`, `marketplace`, `partners`, `payments`, `billing`, `messaging`, `notifications`, `uploads`, `ai`, `ai-worker` (Python), plus `_template` et `_runtimes`.

### Applications (`apps/`)

`web` (PWA étudiante), `partner-portal` (restaurateurs et partenaires), `backoffice` (administration et modération). Les trois compilent avec Next.js App Router.

### Paquets (`packages/`)

`config`, `contracts`, `entitlements`, `errors`, `events`, `messaging`, `service-kit`, `ui`.

## Vérifications faites sur `main`

Poste Windows, Node 22, pnpm 12.4.1, PostgreSQL 18 réel pour les migrations.

| Preuve | Commande | Résultat |
|---|---|---|
| Docs et roadmap | `pnpm docs:verify` | 53 identifiants, 53 prompts, 16 agents — OK |
| Format | `pnpm format:check` | OK |
| Lint | `pnpm lint` | 25 paquets — OK |
| Types | `pnpm typecheck` | 32 paquets — OK |
| Tests | `pnpm exec turbo run test --concurrency=1` | 32 suites — OK |
| Build | `pnpm build` | 25 paquets dont les trois apps Next — OK |
| Garde-fous | `python3 tools/check-{migrations,contracts,pii-logs,secrets}.py` | OK |
| Tests des outils | `python3 -m unittest discover -s tools/tests` | OK |

**Piège Windows** : `pnpm test` en parallèle échoue parfois avec `EPERM … node_modules/.vitest-cache` — plusieurs vitest se disputent le même dossier de cache. Utiliser `pnpm exec turbo run test --concurrency=1`. Ce n'est pas un défaut du code ; la CI (Linux) tourne en parallèle sans problème.

`pnpm ci:guards` ne s'exécute pas sur `main` : `check-ownership.py` exige une branche d'agent. C'est normal — en CI ce job ne tourne que sur les pull requests.

**Non vérifié le 2026-10-29** : la migration `ai/202610291500_pgvector.sql` n'a pas pu être exécutée — Docker Desktop ne démarre pas sur ce poste et le PostgreSQL Windows local n'a pas l'extension. Elle demande un `pnpm dev:infra` puis `node tools/db-migrate.mjs ai` sur l'image `pgvector/pgvector`.

## Piste v1 et branches d'agents : toutes fusionnées

| Branche | Contenu | État |
|---|---|---|
| `v1/socle` | Contrats, erreurs, événements, kit de service, gabarit, runner de migrations, compose dev | fusionnée |
| `v1/gateway` | Routage par manifestes, JWT/JWKS, limites de débit, `/internal/*` bloqué | fusionnée |
| `v1/identity` | OTP haché, JWT RS256 + rotation, profil, validation admin, fiabilité, contact interne | fusionnée |
| `v1/football` | Équipes, défis, matchs, Elo, classements | fusionnée |
| `v1/dating` | Profil, picks, quotas, dates par cartes, annulation 3 h, révélation du contact | fusionnée |
| `v1/talents` | Compétences, publications, missions, avis, événements | fusionnée |
| `v1/marketplace` | Offres à formules, commandes et machine à états, révisions, litiges | fusionnée |
| `integration/v1` | Service IA : embeddings et classement par similarité | fusionnée |
| `agent/money/T-0020` | Campay, grand livre, reversements, rapprochement, relève de secours | fusionnée |
| `agent/football/T-0030` | Arbitrage admin, clôtures idempotentes, compétitions, outbox par lot | fusionnée |
| `agent/web-core/T-0019` | Design system, 23 écrans maquettes, back-office, portail partenaire | fusionnée |
| `agent/dating/T-0035` | Producteur `dating.embedding_requested` : outbox transactionnelle canonique (ADR 0007), relais par lot, planificateur + `/internal/dating/outbox/relay`, schéma producteur co-signé avec l'agent `ai`, test d'intégration opt-in PostgreSQL | fusionnée dans `main` le 2026-10-29 |
| T-0026 (facturation) | Factures (numéro séquentiel), codes promo plafonnés, `past_due` + 3 jours de grâce, expiration (`expired`), résiliation différée, balayage quotidien idempotent | **livré le 2026-10-29, en revue** — voir fiche ; migration `202610291200` avec `drop constraint` → PR étiquette `human-ok` exigée |

Les branches `agent/web-core/T-0007-web-shell`, `T-0007-maquettes-complements` et `T-0009-backoffice-portal` sont **incluses** dans `T-0019-fusion-front` : les fusionner séparément n'apporterait rien et rouvrirait des conflits de `pnpm-lock.yaml`.

### Défauts trouvés par la fusion (corrigés)

1. **Publication unitaire contre un port par lot.** `EventPublisher.publish` prend un **lot** d'enveloppes (ADR 0007). Payments, Billing et l'outbox de Football appelaient encore `publish(envelope)` : `pnpm typecheck` échouait. Tout passe désormais par `publish([envelope])`.
2. **Migration IA non horodatée.** `db/migrations/ai/0001_init.sql` violait la règle `AAAAMMJJHHMM_description.sql` ; renommée `202610282322_init.sql`.
3. **Frontmatter YAML invalide.** `tasks/T-0004-…md` contenait `C:\Users\…` dans une chaîne entre guillemets doubles (`\U` est une échappement invalide) : `check-ownership.py` plantait. Chemin réécrit en barres obliques.

## Décisions humaines (ne pas coder autour)

1. ~~**`docs/product/schema.sql` manquant.**~~ **Close le 2026-10-29** : le fichier d'origine est `docs/product/schema_extension.sql` ([ADR 0003](decisions/0003-schema-base-reconstitue.md)). La comparaison table par table est faite ; les migrations v1 divergent sur les noms et sur des tables absentes (détail dans l'ADR). **Décision attendue : valider l'ordre d'alignement billing → partners → marketplace.**
2. ~~**`docs/product/README.md` manquant**~~ **Écrit le 2026-10-29** : [docs/product/README.md](product/README.md), reconstitué depuis API.md et ARCHITECTURE.md, provenance indiquée en tête.
3. ~~**OTP WhatsApp.**~~ **Tranché le 2026-10-29** : OTP par **SMS uniquement** via MBOASMS ([ADR 0010](decisions/0010-otp-sms-mboasms.md)). WhatsApp est écarté. La clé est en place localement ; il ne manque que l'**URL d'envoi** fournie par MBOASMS (`MBOASMS_URL`), seul point encore non confirmé (voir [docs/vendor/mboasms.md](vendor/mboasms.md)).
4. **Campay.** La démonstration fonctionne (`.env` du poste, collecte réelle constatée). Restent non confirmés : format et signature du webhook, frais, remboursement natif, prélèvement récurrent, plafonds. **Décision attendue : trancher avant F3.2 en production.**
5. **Protection de `main` sur GitHub.** Aucun ruleset n'est actif (`GET /repos/…/rulesets` renvoie `[]`). **Action humaine : activer PR obligatoire + CI verte + squash.** Tant qu'elle est absente, la discipline reste humaine.
6. ~~**`pgvector` sous Windows.**~~ **Réglé le 2026-10-29** : la colonne `ai.embeddings.vector` passe au type natif `vector(64)` avec index HNSW (`db/migrations/ai/202610291500_pgvector.sql`), et le service lit/écrit le littéral pgvector. Le développement utilise l'image `pgvector/pgvector:pg17` du compose ; un PostgreSQL Windows sans extension n'est plus supporté pour le service IA.
7. **Grand livre à double écriture.** [ADR 0008](decisions/0008-grand-livre-double-ecriture.md) attend une validation humaine avant F3.1.
8. **Jest → Vitest.** [ADR 0004](decisions/0004-nestjs-esm-vitest.md) : NestJS 12 est ESM-only. À valider, et `docs/STACK.md` §2 à corriger en conséquence.
9. **Stockage des fichiers.** Le service uploads écrit sur disque local ; le fournisseur S3-compatible (R2, Scaleway, MinIO) et la sauvegarde restent à choisir avant toute mise en ligne.
10. **Argent réel.** `FakePaymentsGateway` reste le défaut hors démonstration ; aucun encaissement, séquestre, remboursement ni abonnement n'est réellement possible en production avant F3.1 à F3.4.
11. **Domaine.** `api.convexa.app` est une hypothèse ([ADR 0001](decisions/0001-marque-convexa.md)) ; le domaine réel est une tâche humaine.
12. **Juridique.** Le dossier [legal/](../legal/README.md) liste les dix documents à produire (séquestre, CGU/CGV, RGPD, accord de l'école, contrats prestataire et fournisseurs, mentions légales). **Action humaine : le remplir.** Rien n'est exploitable en production avant l'avis sur le séquestre.

## Tâches encore ouvertes

| Tâche | Sujet | État |
|---|---|---|
| [T-0026](../tasks/T-0026-factures-codes-promo-grace-expiration.md) | Factures, codes promo, grâce et expiration des abonnements | **review** (code livré, PR avec étiquette `human-ok` attendue) |
| T-0035 et suivantes | Écrans branchés sur les contrats, messagerie temps réel, crons de clôture | partie outbox dating livrée ; reste à découper |

## Protocole multi-instances (à lire avant de coder)

Une instance = une tâche = une branche = un worktree. **Personne ne travaille dans `CONEXA/` lui-même** : le répertoire principal reste sur `main`, propre, réservé à l'orchestrateur et à l'humain.

```bash
# 1. Réclamer la tâche (le statut est le verrou)
cd CONEXA
git fetch origin
git worktree add ../worktrees/T-0026 -b agent/money/T-0026-factures origin/main
cd ../worktrees/T-0026
pnpm install --frozen-lockfile
# dans le fichier de tâche : status: in_progress, branch, worktree
# puis commit "chore(tasks): claim T-0026" et push immédiat
```

- **Verrou** : si le push de la réclamation est refusé, la tâche est déjà prise — en choisir une autre, ne pas forcer.
- **Chemins** : n'écrire que dans `agents/ownership.yaml` **et** dans les `owned_paths` de la tâche.
- **Contrat d'abord** : un endpoint ou un événement nouveau se publie avant d'être consommé.
- **Pas de `main`** : jamais de commit direct sur `main` hors bootstrap ; on pousse sa branche, l'orchestrateur (ou l'humain) fusionne.
- **Une seule tâche à la fois** par instance ; une seule instance par domaine à un instant donné.
- **Clôture** : PR ouverte, CI verte, preuves jointes, statut `review`.

## Prochaines étapes

1. Brancher réellement les écrans sur `@conexa/contracts` (les contrats sont la seule interface stable) et remplacer les données de maquette.
2. Argent en production : confirmer les points Campay de la section 3.2, puis brancher le grand livre à double écriture et la facturation (T-0021 à T-0026).
3. OTP réel : brancher ETECH KEY / MBOASMS dès que les variables sont fournies, puis écrire l'ADR du fournisseur.
4. Messagerie temps réel, notifications et crons de clôture (validations 72 h, contestations 48 h, vote MVP).
5. Uploads en production : choisir le stockage S3-compatible et la politique de sauvegarde.
