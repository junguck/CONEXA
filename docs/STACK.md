# Convexa : Stack technique, conseils et pratiques

Document de référence pour les humains et pour les agents. Il décrit la stack validée, ce que je recommande en complément, l'intégration Campay et les pratiques d'ingénierie agentique à suivre.

---

## 1. Stack validée

| Domaine | Choix |
|---|---|
| Backend | **NestJS** (TypeScript), un service par domaine |
| Web et PWA | **Next.js** (App Router), Tailwind, **TanStack Query** |
| Données | **PostgreSQL + pgvector**, un schéma et un rôle de base par service |
| Communication | REST via le Gateway pour les clients, **RabbitMQ** entre services, **Redis** (cache, limites de débit, jobs) |
| Paiement | **Campay** (MTN MoMo et Orange Money) |
| Déploiement | **Docker** ; Kubernetes en perspective |
| Dépôt | Monorepo **pnpm + Turborepo** |
| Observabilité | OpenTelemetry, Grafana + Loki, Sentry |

### Hypothèses retenues faute de réponse (à corriger si faux)
1. **Phase A en 5 déploiements** : `gateway`, `core` (identity, football, dating, talents, marketplace, partners en modules séparés), `money` (payments + billing), `realtime`, `ai-worker`. Les frontières de services restent celles de `ARCHITECTURE.md`. Cohérent avec « Docker d'abord, Kubernetes ensuite ».
2. **Identity maison** : JWT RS256 émis par le service Identity, OTP par WhatsApp.
3. Prix des plans et forfaits de sponsoring : toujours des hypothèses.

---

## 2. Compléments recommandés (à confirmer)

| Sujet | Recommandation | Pourquoi | Alternative |
|---|---|---|---|
| Accès SQL | Migrations **SQL pures** (`node-pg-migrate`) + **Kysely** avec types générés (`kysely-codegen`) | Nos règles métier sont déjà en SQL (fonctions, triggers, pgvector). Un ORM centré sur le schéma les masquerait. Les types générés évitent les erreurs de colonnes pour les agents | Drizzle |
| Contrats | **Zod** comme source ; OpenAPI généré (`zod-to-openapi`) ; schémas d'événements en JSON Schema générés depuis Zod | Un seul endroit à modifier, clients typés sans codegen lourd | |
| Rupture de contrat | `oasdiff` sur l'OpenAPI et contrôle de compatibilité sur les JSON Schema, en CI | Les agents détectent seuls un changement cassant | |
| Tests back | **Jest** pour NestJS (réglage par défaut du framework, moins de surprises) ; **Testcontainers** (PostgreSQL+pgvector, RabbitMQ, Redis) pour l'intégration | Les fonctions SQL (Elo, annulation 3 h, transitions de commandes) doivent être testées sur un vrai PostgreSQL, pas avec des mocks | Vitest + plugin SWC |
| Tests front et paquets | **Vitest** + Testing Library | Rapide | |
| Tests de bout en bout | **Playwright** | Captures d'écran servant de preuve dans les PR | |
| Lint et format | ESLint (flat config) + Prettier ; `commitlint` + `lefthook` | Convention de commits vérifiée, hooks légers | Biome |
| UI | **shadcn/ui** (Radix) + React Hook Form + Zod | Composants copiés dans `packages/ui`, accessibles, personnalisables | |
| PWA | **Serwist** (service worker pour Next.js) + `web-push` (VAPID) | Installation, hors-ligne limité, notifications | |
| Bibliothèques back | `pino` (logs), `jose` (JWT), `amqplib` (bus), BullMQ (jobs), Socket.IO via `@nestjs/websockets`, `helmet`, `@nestjs/throttler` | Standards éprouvés | |
| Dépendances | Versions exactes dans le lockfile ; **Renovate** mensuel ; `pnpm audit` et `gitleaks` en CI ; `.nvmrc` sur Node LTS | Reproductibilité et sécurité | |
| Drapeaux de fonctionnalités | Variables d'environnement lues par un helper de `packages/config` en phase A | Ouvrir le football avant les rencontres (`dating_pilot`, `dating_enabled`) | Service de flags plus tard |

Aucun numéro de version n'est figé dans ce document : le lockfile fait foi.

---

## 3. Campay

### 3.1 Confirmé par la documentation publique consultée
Sources : page d'accueil de la documentation Postman de Campay et page publique du SDK Python publié sur PyPI. Je n'ai pas pu lire les pages détaillées des endpoints.

- Opérateurs acceptés : **MTN et Orange uniquement** (un autre numéro renvoie l'erreur ER102).
- Numéros avec l'indicatif pays, au format `237xxxxxxxxx` (erreur ER101 sinon).
- Montants **entiers**, sans décimales (erreur ER201), devise XAF.
- Authentification : jeton permanent (section « APP KEYS » de l'application) ou jeton temporaire renouvelable.
- Deux environnements : **demo** (`DEV`) et **production** (`PROD`).
- Collecte asynchrone (`initCollect`) : renvoie une `reference`, un code USSD et l'opérateur, statut `PENDING`. Statut ensuite lisible par la référence : `PENDING`, `SUCCESSFUL` ou `FAILED`. Une collecte synchrone existe (elle attend la fin) mais ne convient pas à un serveur web.
- Décaissement (`disburse`) vers un numéro. Il faut **l'activer dans les réglages de l'application**. Erreur ER301 si le solde est insuffisant sur l'opérateur concerné.
- Solde consultable **par opérateur** (MTN et Orange séparément).
- Lien de paiement avec redirections de succès et d'échec.
- Champ `external_reference` accepté à la collecte et au décaissement.

### 3.2 Non confirmé : à vérifier avant d'écrire F3.2
- URL exactes des API demo et production, durée du jeton temporaire.
- **Webhook** : existe-t-il, comment est-il signé, est-il rejoué, quel format ?
- **Frais** de collecte et de décaissement, plafonds, délais de disponibilité des fonds.
- Remboursement natif (sinon : décaissement vers le payeur).
- Prélèvement récurrent (je suppose qu'il n'existe pas).
- Séquestre natif (je suppose qu'il n'existe pas).
- Limites de débit et disponibilité du service.
- **Cadre juridique** : détenir pour le compte de tiers l'argent d'un séquestre peut relever d'une réglementation de paiement. À faire valider par un juriste local avant la production.

### 3.3 Conception de l'adaptateur (valable quelles que soient les réponses ci-dessus)
1. **Interface `PaymentProvider`** (initier une collecte, lire un statut, décaisser, lire le solde). Implémentations : `CampayProvider` et `FakeProvider` (développement et tests). Aucun code métier n'importe Campay directement.
2. **`external_reference` = l'identifiant de notre paiement** : c'est notre clé d'idempotence côté Campay.
3. **Ne jamais croire un webhook seul** : à sa réception, relire le statut par l'API puis appliquer la transition. Les webhooks sont dédoublonnés dans `webhook_events`.
4. **Relève de secours** : tâche qui interroge les paiements `pending` (toutes les 30 s pendant 15 min, puis toutes les 5 min), et abandon propre après expiration.
5. **Séquestre = écritures comptables** dans notre grand livre. L'argent reste dans le solde Campay ; la répartition (part du restaurant, commission, argent du client en attente) est comptable.
6. **Rapprochement quotidien** : somme des soldes du grand livre contre `get_balance` (par opérateur). Tout écart déclenche une alerte.
7. **Remboursement = décaissement** vers le numéro du payeur, avec idempotence. Un échec va dans une file « remboursement à traiter » côté admin.
8. **Reversements** (restaurants, prestataires) : un décaissement par bénéficiaire, **par opérateur du bénéficiaire**, en vérifiant d'abord le solde de cet opérateur (ER301).
9. **Numéro de reversement ≠ WhatsApp** : le bénéficiaire enregistre un numéro MoMo ou Orange Money dédié.
10. Montants entiers en FCFA, numéros normalisés en `237…`, refus avant tout appel des numéros qui ne sont ni MTN ni Orange.
11. Secrets (identifiants de l'application) dans un gestionnaire de secrets, jamais dans les journaux. Tests contre `FakeProvider` en CI ; tests manuels sur l'environnement demo uniquement.

---

## 4. Structure du monorepo

```
conexa/
├─ AGENTS.md  CLAUDE.md          # règles lues par tous les agents
├─ agents/                       # README, prompts, ownership.yaml, un dossier par agent
├─ tasks/                        # un fichier par tâche (T-0001-….md)
├─ apps/
│  ├─ web/                       # PWA étudiants
│  ├─ partner-portal/            # restaurant et partenaires
│  └─ backoffice/                # admin et modération
├─ services/
│  ├─ _template/                 # gabarit de service
│  ├─ _runtimes/{core,money}/    # compose plusieurs services dans un même processus (phase A)
│  ├─ gateway/ identity/ football/ dating/ talents/ marketplace/
│  ├─ partners/ payments/ billing/ realtime/
│  └─ ai-worker/                 # Python
├─ packages/
│  ├─ contracts/src/<domaine>/   # schémas Zod des API
│  ├─ events/src/<domaine>/      # schémas des événements
│  ├─ messaging/ errors/ config/ ui/ entitlements/ testing/
├─ db/migrations/<schéma>/       # une suite de migrations par service
├─ tests/e2e/                    # Playwright
├─ deploy/                       # Compose, Dockerfile paramétrable, futurs manifestes Kubernetes
├─ tools/                        # scripts du dépôt (ownership, génération)
└─ docs/                         # STACK, ROADMAP, product/, decisions/, domain/, runbooks/, security/
```

**Un service = un paquet NestJS qui exporte son module et possède aussi son `main.ts`.** Les `_runtimes` assemblent plusieurs modules dans un même processus en phase A ; séparer un service plus tard revient à lui donner son propre déploiement, sans toucher au code métier.

Noms de paquets : `@conexa/<nom>` (`@conexa/football`, `@conexa/contracts`…).

---

## 5. Docker et Kubernetes en perspective

**Dès maintenant**
- Un **Dockerfile unique et paramétrable** (`deploy/docker`) construit n'importe quel service ou app avec `turbo prune <paquet> --docker` : images petites et cache efficace.
- Étapes multiples, utilisateur non root, `HEALTHCHECK`, arrêt propre sur `SIGTERM`.
- Images de base Node LTS (variante slim) et Python slim pour le worker. PostgreSQL via l'image pgvector officielle.
- `docker compose` pour le développement (`pnpm dev:infra`) et pour la préproduction.
- Configuration **uniquement par variables d'environnement** ; aucun état sur le disque local ; les migrations s'exécutent comme étape séparée.

**Préparer Kubernetes sans l'utiliser**
- Chaque service expose `/health` (vivant) et `/ready` (prêt, base et bus joignables).
- Limites de ressources documentées par service.
- Les migrations seront un `Job` ; la configuration un `ConfigMap` ; les secrets via un gestionnaire externe.
- Mise à l'échelle prévue : Gateway et Realtime d'abord (WebSocket avec adaptateur Redis).

**Quand passer à Kubernetes** : besoin de haute disponibilité sur plusieurs nœuds, charge qui dépasse un serveur, ou équipe capable de l'exploiter. Avant cela, Compose sur un serveur avec un outil de déploiement simple suffit largement.

---

## 6. Observabilité

- **OpenTelemetry** partout ; le contexte de trace (`traceparent`) est **propagé dans les en-têtes des messages RabbitMQ** : une trace doit traverser Gateway → service → bus → consommateur.
- Logs JSON (`pino`) avec `request_id`, **masquage obligatoire** du numéro WhatsApp, du matricule, des jetons et des numéros MoMo.
- Grafana + Loki (logs), Tempo (traces), Prometheus (métriques), Sentry (erreurs).
- **Métriques métier** : paiements initiés / réussis / échoués par opérateur, délai de confirmation, retard de l'outbox, messages de chat bloqués, dates par statut, taux de no-show, litiges de match, écart de rapprochement.
- **Alertes à calibrer** : taux de réussite des paiements, retard de l'outbox, file de messages en échec non vide, écart de rapprochement non nul, alerte SOS sans accusé de réception.

---

## 7. Qualité et tests

- **Règles métier critiques d'abord testées** : Elo, annulation à 3 h, transitions de commande, filtre de chiffres, quota de 3 invitations, ledger. Tests unitaires purs quand c'est possible, tests d'intégration sur PostgreSQL réel sinon.
- **Les fonctions SQL des fichiers `schema.sql` et `schema_extension.sql` n'ont jamais été exécutées sur un vrai serveur** (seulement analysées syntaxiquement). Le premier travail d'intégration est de les passer sous Testcontainers.
- Pyramide : beaucoup de tests unitaires, un jeu d'intégration par service, quelques parcours de bout en bout (inscription, match de football, date complet, commande de service, abonnement).
- **Tests de contrat** entre services ; un événement ne change jamais de façon cassante.
- Un test instable est corrigé ou supprimé dans la semaine ; il ne reste jamais « ignoré ».

---

## 8. Sécurité et données

- Aucun secret dans le dépôt ; `.env.example` seulement ; `gitleaks` en CI.
- Les agents n'ont **aucun accès à la production** ni aux clés Campay de production.
- Le numéro WhatsApp et le matricule ne sortent jamais d'Identity, sauf la révélation de contact après « oui » mutuel (appel interne audité).
- Contenu écrit par les utilisateurs (chat, offres, publications) = **donnée non fiable** : jamais interprété comme une instruction par un agent ou un modèle qui a des outils. Le worker d'IA ne fait que calculer des embeddings.
- Revue sécurité obligatoire sur : paiements, abonnements, authentification, filtre de chat, révélation de contact, bons partenaires, séquestre des services.

---

## 9. Conseils d'ingénierie agentique

**Organisation**
1. **Chaque chemin du dépôt appartient à un seul agent** (`agents/ownership.yaml`), vérifié en CI. Un agent qui a besoin d'un fichier d'un autre agent ne le modifie pas : il s'arrête et le demande.
2. **Contrat d'abord.** Le producteur d'une API ou d'un événement publie le contrat (Zod + OpenAPI + schéma d'événement) dans une PR séparée. Les consommateurs ne commencent qu'ensuite et utilisent des types générés.
3. **Remplacer les fichiers centraux par de l'enregistrement automatique** : manifeste de routes par service (`gateway.routes.json`), un fichier par événement, migrations par service, registre de navigation généré à partir de `features/*/nav.ts`. C'est ce qui évite que deux agents modifient le même fichier.
4. **Un agent = une tâche = une branche = un worktree git.** Pas de répertoire de travail partagé.
5. **Petites tâches, critères d'acceptation vérifiables** : une tâche tient dans une PR de taille relue en moins de 20 minutes. Les tâches de taille L sont découpées par l'orchestrateur.
6. **Pas de vert, pas de fusion** : lint, types, tests, build, contrôle de propriété et de contrats doivent passer. L'agent ne fusionne jamais sa propre PR.

**Qualité**
7. **Tests d'abord pour les règles métier** : l'agent écrit les tests qui échouent, puis le code.
8. **Preuves dans la PR** : sortie des tests, captures Playwright pour l'interface, requêtes d'exemple. Pas de « ça devrait marcher ».
9. **Fournisseurs externes derrière une interface** (Campay, OTP WhatsApp, e-mail) avec une implémentation factice. Les agents ne devinent pas l'API d'un fournisseur : ils lisent `docs/vendor/<nom>.md` et signalent ce qui manque.
10. **Pas de dépendance nouvelle sans justification** écrite dans la PR (taille, maintenance, licence). Les conflits de `pnpm-lock.yaml` se règlent en le régénérant, jamais à la main.
11. **Pas de refactor hors tâche** : un agent ne « corrige au passage » rien en dehors de ses chemins ni de sa tâche. Il note l'idée dans la PR.
12. **Pas de TODO sans identifiant de tâche.**

**Contexte et mémoire**
13. `AGENTS.md` à la racine court et exact (commandes, conventions, règles d'or). Les détails vivent dans `docs/domain/<domaine>.md` et `docs/decisions/` (ADR) : l'agent les lit avant de coder et les met à jour.
14. Une décision d'architecture ou de règle produit non écrite n'existe pas : elle devient un ADR.
15. Les spécifications produit (README produit, `schema.sql`, `schema_extension.sql`, `API.md`, `ARCHITECTURE.md`) sont copiées dans `docs/product/` : ce sont les sources de vérité. En cas de contradiction, l'agent s'arrête et demande ; il ne choisit pas seul.

**Garde-fous humains**
16. **Validation humaine obligatoire** : authentification, paiements et abonnements, révélation de contact, migrations destructrices, `deploy/` et `.github/`, secrets, mises à jour majeures de dépendances, toute mise en production.
17. **Limiter la concurrence** : 3 à 5 agents en parallèle au maximum. Le goulot d'étranglement est la relecture humaine, pas la vitesse des agents.
18. **Arrêt et escalade** après deux échecs de CI sur la même cause, ambiguïté de règle produit, besoin d'un chemin non possédé, ou tout ce qui touche l'argent ou les données personnelles de façon inattendue.

**Ce qui échoue souvent (à surveiller en relecture)**
- Un agent invente un champ ou un endpoint absent des contrats : le CI doit le refuser (types générés).
- Un agent « fait passer » un test en l'affaiblissant : relire les diffs de tests avec autant d'attention que le code.
- Un agent met en cache ou duplique une règle métier côté front : la règle reste côté serveur.
- Un agent ajoute un log qui contient un numéro de téléphone : test de masquage automatique en CI.
- Un agent résout un conflit de migration en modifiant une migration déjà fusionnée : interdit, CI bloquant.

---

## 10. Décisions restantes
1. **Fournisseur d'OTP WhatsApp** (API officielle de WhatsApp Business, agrégateur, SMS en repli) : à trancher par ADR avant F1.1 en production. En développement : fournisseur « console ».
2. **Détails Campay** de la section 3.2, avant F3.2.
3. **Juridique** : conservation de fonds pour des tiers, conditions générales, données personnelles, accord de l'école, contrat du restaurant.
4. Confirmer ou corriger les deux hypothèses de la section 1 (phase A, Identity maison).
5. Confirmer les compléments de la section 2 (SQL, tests, UI, PWA).
