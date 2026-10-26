# Prompts des fonctionnalités de la roadmap

Un prompt par identifiant de `docs/ROADMAP.md`. Il fournit à l'orchestrateur les champs **OBJECTIF, À LIRE, PRODUIRE, RÈGLES, CRITÈRES, HORS PÉRIMÈTRE** du gabarit de tâche (`PROMPTS_BASE.md` §2). L'orchestrateur y ajoute l'identifiant de tâche, la branche, les `owned_paths` exacts et les dépendances terminées, puis le lance avec le préambule commun et le prompt de l'agent (`PROMPTS_BASE.md` §1 et §3).

**Conventions**
- `PRÉREQUIS` : décision ou document à obtenir **avant** de coder. S'il manque, l'agent écrit l'ADR avec options et recommandation, puis s'arrête (`blocked`).
- `DÉCOUPAGE` : indication pour l'orchestrateur sur les tâches de taille L ; chaque sous-tâche a sa PR et ses `owned_paths` disjoints.
- Quand une fonctionnalité a deux agents, l'orchestrateur crée **une tâche par agent** ; chacun n'écrit que dans ses chemins et les échanges passent par contrats et événements.
- Les chemins précis viennent de `agents/ownership.yaml`, jamais de ce fichier.

---

## Vague 0 : Fondations

### F0.1 — Monorepo pnpm + Turborepo, outillage qualité
**Agent** `platform` · **Dépend de** — · **Taille** S
```text
OBJECTIF : créer le squelette du monorepo et l'outillage qualité commun.
À LIRE : AGENTS.md ; docs/STACK.md §4 (monorepo) et §6 (qualité) ; agents/ownership.yaml.
PRODUIRE : package.json racine, pnpm-workspace.yaml, turbo.json (tâches lint, typecheck, test, build, dev avec cache et dépendances), tsconfig de base, ESLint + Prettier, commitlint + lefthook (Conventional Commits, trailer `Task:`), .nvmrc, .editorconfig, .gitignore, .env.example, arborescence vide apps/ services/ packages/ deploy/ tools/ tests/ docs/ conforme à STACK.md. Créer packages/config (tsconfig/eslint partagés).
RÈGLES : versions épinglées ; Node LTS ; aucune dépendance applicative ; les commandes de AGENTS.md qui n'existent pas encore sont listées dans docs/domain/platform.md avec la tâche qui les crée.
CRITÈRES : - [ ] `pnpm install` réussit à froid - [ ] `pnpm turbo run lint typecheck test build` réussit sur un paquet d'exemple - [ ] un commit non conforme est refusé par commitlint - [ ] le cache Turbo est utilisé au deuxième passage.
HORS PÉRIMÈTRE : Docker (F0.2), CI (F0.3), contrats (F0.4).
```

### F0.2 — Environnement de développement Docker Compose
**Agent** `platform` · **Dépend de** F0.1 · **Taille** M
```text
OBJECTIF : `pnpm dev:infra` démarre toute l'infrastructure locale en une commande.
À LIRE : docs/STACK.md §5 (Docker) ; docs/product/ARCHITECTURE.md §3 (un schéma par service).
PRODUIRE : deploy/compose.dev.yaml avec PostgreSQL + pgvector, Redis, RabbitMQ (interface de gestion), stockage objet compatible S3 (MinIO), collecteur OpenTelemetry ; script d'initialisation PostgreSQL qui crée un schéma ET un rôle par service (identity, football, dating, talents, marketplace, partners, payments, billing, realtime) avec droits limités à son schéma ; scripts `dev:infra`, `dev:reset`, `dev:down` ; vérifications de santé.
RÈGLES : un rôle ne lit jamais le schéma d'un autre ; mots de passe de développement uniquement dans .env.example ; volumes nommés ; extension `vector` activée.
CRITÈRES : - [ ] démarrage à froid < 2 min avec états `healthy` - [ ] un test prouve qu'un rôle ne peut pas lire un autre schéma - [ ] `dev:reset` repart d'une base vide.
HORS PÉRIMÈTRE : Dockerfile des services (F0.5/F0.6), préproduction (F6.4). VALIDATION HUMAINE : deploy/.
```

### F0.3 — CI et garde-fous (propriété, contrats, migrations)
**Agent** `platform` · **Dépend de** F0.1 · **Taille** M
```text
OBJECTIF : une CI qui refuse automatiquement les erreurs de collision et de sécurité.
À LIRE : agents/README.md (règles anti-collision) ; agents/GIT_WORKFLOW.md ; agents/ownership.yaml ; docs/STACK.md §6 et §8.
PRODUIRE : .github/workflows (lint/types/tests/build ciblés par `--filter=...[origin/main]`, tests d'intégration, gitleaks, pnpm audit) ; tools/check-ownership (lit ownership.yaml, le fichier de tâche et le diff : échec si un fichier modifié sort des chemins de l'agent ou de `owned_paths`) ; tools/check-migrations (nom horodaté, ordre, aucune migration fusionnée modifiée, drapeau si destructrice) ; tools/check-contracts (oasdiff + schémas d'événements : rupture = échec) ; test de masquage des PII dans les journaux ; modèle de PR ; CODEOWNERS ; étiquettes de revue et règle « fusion seulement avec étiquettes requises » ; tests des outils eux-mêmes.
RÈGLES : le contrôle de propriété est bloquant, pas consultatif ; messages d'erreur clairs (quel fichier, quel agent, quelle règle) ; l'agent est identifié par le nom de branche.
CRITÈRES : - [ ] PR d'exemple touchant un chemin étranger : CI rouge avec message clair - [ ] migration fusionnée modifiée : rouge - [ ] champ de contrat supprimé : rouge - [ ] secret factice : rouge.
HORS PÉRIMÈTRE : déploiement. VALIDATION HUMAINE : .github/.
```

### F0.4 — Paquets partagés : contrats, événements, messagerie, erreurs
**Agent** `architect` · **Dépend de** F0.1 · **Taille** M
```text
OBJECTIF : le langage commun de tous les services.
À LIRE : docs/product/API.md §1 (conventions), §6 (codes d'erreur) ; docs/product/ARCHITECTURE.md §4 (événements, outbox/inbox) ; docs/STACK.md §3.3 et §7.
PRODUIRE : packages/contracts (Money entier FCFA, pagination par curseur, enveloppe d'erreur, catalogue des codes d'erreur, utilitaires zod-to-openapi) ; packages/events (enveloppe : id, type, version, occurred_at, producer, traceparent, payload ; génération de JSON Schema) ; packages/messaging (publication depuis la table outbox, consommation avec table inbox idempotente, topologie RabbitMQ : échange topic, files durables, file des échecs, reprises avec délai croissant, propagation de traceparent dans les en-têtes AMQP) ; packages/errors (erreurs métier → HTTP) ; ADR du format d'événement.
RÈGLES : un événement a un seul producteur ; versionné ; jamais de PII dans un événement (identifiants seulement, sauf cas validé en ADR) ; livraison au moins une fois, donc consommateurs idempotents ; l'ordre n'est pas garanti.
CRITÈRES : - [ ] tests d'intégration sur vrai RabbitMQ + PostgreSQL : publication transactionnelle, doublon ignoré, reprise après panne, file des échecs - [ ] OpenAPI et schémas générés par `pnpm gen:contracts` - [ ] tous les codes d'erreur de API.md présents.
HORS PÉRIMÈTRE : contrats de domaine (chaque agent les possède).
```

### F0.5 — Gabarit de service NestJS et générateur
**Agent** `architect` · **Dépend de** F0.2, F0.4 · **Taille** M
```text
OBJECTIF : `pnpm new:service <nom>` crée un service prêt pour la CI, identique pour tous.
À LIRE : docs/STACK.md §3 à §7 ; docs/product/ARCHITECTURE.md §3 et §10 (phase A : composition en déployables) ; packages/{contracts,events,messaging,errors}.
PRODUIRE : services/_template (NestJS, config validée par Zod, connexion Kysely par schéma et rôle, node-pg-migrate avec dossier de migrations horodatées, outbox/inbox câblées, santé /health et /ready, pino avec masquage de PII, OpenTelemetry, garde JWT (clés JWKS), manifeste gateway.routes.json, Dockerfile paramétrable), outil `tools/new-service`, scripts `db:migrate` et `db:codegen`, exemple minimal publiant et consommant un événement, runtimes de composition services/_runtimes/core et money.
RÈGLES : un service = un schéma = un rôle ; aucune importation d'un autre service ; les modules de domaine sont exportables pour être composés dans un runtime commun ; aucun fichier central à éditer pour ajouter un service (enregistrement automatique).
CRITÈRES : - [ ] service généré passe lint, types, tests et CI - [ ] publie et consomme un événement dans un test d'intégration - [ ] trace bout en bout visible - [ ] ajout d'un second service sans modifier de fichier existant.
HORS PÉRIMÈTRE : logique de domaine.
```

### F0.6 — Observabilité de base
**Agent** `platform` · **Dépend de** F0.2, F0.5 · **Taille** M
```text
OBJECTIF : voir ce qui se passe : traces, métriques, journaux, erreurs.
À LIRE : docs/STACK.md §5 (observabilité) ; services/_template.
PRODUIRE : Grafana, Loki, Tempo, Prometheus dans deploy/ (profil dev) ; tableaux de bord : santé des services, latence et erreurs par route, profondeur et échecs des files RabbitMQ, paiements (créés, séquestre, échecs), notifications ; alertes de base ; intégration Sentry ; correspondance entre journaux et traces par traceparent ; test de masquage des PII ; docs/runbooks/observability.md.
RÈGLES : aucune PII dans les journaux, métriques ni libellés ; cardinalité des métriques maîtrisée (jamais d'identifiant utilisateur en étiquette).
CRITÈRES : - [ ] une requête traverse gateway → service → bus → consommateur dans une seule trace - [ ] tableau de bord des files alimenté - [ ] test de masquage vert.
VALIDATION HUMAINE : deploy/.
```

### F0.7 — Design system et coquille de l'app web (PWA)
**Agent** `web-core` · **Dépend de** F0.1 · **Taille** M
```text
OBJECTIF : le socle visuel et technique du front.
À LIRE : docs/STACK.md §2 ; docs/product/README.md §16 (écrans) ; docs/product/API.md §1–2.
PRODUIRE : packages/ui (jetons Tailwind, mode sombre, composants shadcn/Radix : Button, Input, Select, Dialog, Sheet, Tabs, Toast, Avatar, Badge, Skeleton, EmptyState, Table) ; apps/web (Next.js App Router, navigation basse mobile, gardes d'authentification et de rôle, TanStack Query, client d'API typé depuis packages/contracts, gestion des codes d'erreur métier, i18n français) ; PWA avec Serwist (manifeste, icônes, page hors-ligne, invite de mise à jour, abonnement push VAPID) ; générateur de registre `pnpm gen:registry` qui lit src/features/*/nav.ts et construit la navigation ; budgets Lighthouse CI ; Storybook ou page de démonstration des composants ; un domaine d'exemple prouvant l'ajout d'un écran sans fichier partagé.
RÈGLES : mobile d'abord ; accessibilité (contraste, focus, libellés) ; états chargement/erreur/vide ; aucune règle métier dupliquée ; aucune PII dans l'analytique.
CRITÈRES : - [ ] installable en PWA (audit Lighthouse) - [ ] ajout d'un écran de démonstration en créant uniquement des fichiers dans un dossier de domaine - [ ] tests de composants verts.
HORS PÉRIMÈTRE : écrans métier.
```

### F0.8 — Gateway : squelette
**Agent** `gateway` · **Dépend de** F0.5 · **Taille** M
```text
OBJECTIF : le point d'entrée unique, sans logique métier.
À LIRE : docs/product/API.md §1 et §9 ; docs/product/ARCHITECTURE.md §5.
PRODUIRE : services/gateway (NestJS) : découverte des manifestes services/*/gateway.routes.json ; proxy ; vérification JWT RS256 par JWKS avec cache et rotation (prête pour F1.1, testée avec des clés de test) ; limitation de débit Redis (120/min par utilisateur, 10/min sur /auth/*, 30 messages/min chat) ; X-Request-Id et traceparent ; normalisation des erreurs ; CORS, helmet ; blocage de /internal/* ; proxy WebSocket vers realtime ; tests.
RÈGLES : états de compte (pending → seules les routes marquées autorisées ; suspended/banned → ACCOUNT_SUSPENDED) ; aucune donnée sensible dans les journaux.
CRITÈRES : - [ ] un service généré est routé sans modifier le gateway - [ ] jeton expiré/invalide → UNAUTHENTICATED - [ ] /internal/* inaccessible - [ ] dépassement de débit → 429 au format d'erreur.
HORS PÉRIMÈTRE : émission des jetons (identity).
```

### F0.9 — Coquilles du back-office et du portail partenaire
**Agent** `web-core` · **Dépend de** F0.7 · **Taille** S
```text
OBJECTIF : deux apps front prêtes à recevoir les écrans des domaines.
À LIRE : docs/STACK.md §2 ; docs/product/API.md §3.9 et §3.19 (rôles admin et partenaire).
PRODUIRE : apps/backoffice et apps/partner-portal avec la même base que apps/web (packages/ui, client typé, gardes de rôle), navigation générée par registre (`(admin)/<domaine>` et `(portal)`), mise en page adaptée (tables, filtres, formulaires), authentification par rôle, page d'accueil de chaque app.
RÈGLES : mêmes principes que F0.7 ; le portail est utilisable sur tablette et téléphone (le personnel du restaurant utilise un téléphone en service).
CRITÈRES : - [ ] un domaine d'exemple ajoute une page en ne créant que ses propres fichiers - [ ] garde de rôle testée.
HORS PÉRIMÈTRE : écrans métier.
```

---

## Vague 1 : Socle (identité et notifications)

### F1.1 — Authentification : OTP WhatsApp et JWT
**Agent** `identity` · **Dépend de** F0.5, F0.8 · **Taille** M · **Validation humaine** oui
```text
OBJECTIF : connexion par code OTP envoyé sur WhatsApp, avec jetons sûrs.
PRÉREQUIS : l'ADR du choix du fournisseur d'OTP WhatsApp est décidé par l'humain (trou n°5). S'il manque : écris l'ADR avec options et recommandation, implémente derrière une interface `OtpSender` avec un envoi factice, et arrête-toi pour validation.
À LIRE : docs/product/API.md §3.1 ; docs/product/schema.sql (§2 Identité) ; docs/STACK.md §8 ; docs/product/README.md §4.
PRODUIRE : endpoints d'authentification du contrat ; OTP haché, expiration 5 minutes, 5 essais, plafond quotidien par numéro, limites de débit ; JWT RS256 d'une heure et jeton de rafraîchissement à rotation avec détection de réutilisation (révocation de la famille) ; JWKS ; migrations ; événement d'audit de connexion ; tests.
RÈGLES : numéro normalisé `237…` ; aucun numéro ni code dans les journaux ; réponse identique que le compte existe ou non (pas d'énumération) ; comparaison à temps constant.
CRITÈRES : - [ ] tests de force brute, rejeu, expiration, rotation et réutilisation de jeton - [ ] aucune PII dans les journaux (test) - [ ] JWKS consommé par le gateway en test d'intégration.
HORS PÉRIMÈTRE : profil (F1.2), écrans (F1.6). RELECTEURS : security, human.
```

### F1.2 — Inscription, profil, photo, matricule
**Agent** `identity` · **Dépend de** F1.1 · **Taille** M
```text
OBJECTIF : créer un compte étudiant complet en attente de validation.
À LIRE : docs/product/API.md §3.1 ; docs/product/schema.sql (§2) ; docs/product/README.md §4.
PRODUIRE : inscription (nom, matricule, WhatsApp, âge, filière, photo) ; téléversement de photo par URL signée avec contrôle de type et de taille ; statut `pending` ; profil lisible et modifiable ; `GET /users` et cartes publiques (sans WhatsApp ni matricule) ; événements `user.created`, `user.updated` ; contrat des cartes utilisateur pour les autres services ; copie locale alimentée par événements pour la recherche « sans équipe » (trou n°3, avec F2.1).
RÈGLES : matricule et WhatsApp uniques ; âge minimum 15 ans ; données sensibles jamais exposées ; compte `pending` limité à l'inscription et au profil.
CRITÈRES : - [ ] tests d'unicité, d'âge, de fichiers invalides - [ ] aucun champ sensible dans les réponses publiques (test automatique) - [ ] événements conformes aux schémas.
HORS PÉRIMÈTRE : validation admin (F1.3), écrans (F1.6).
```

### F1.3 — File de validation admin (API + écrans back-office)
**Agent** `identity` · **Dépend de** F1.2, F0.9 · **Taille** M
```text
OBJECTIF : un admin approuve ou rejette les inscriptions.
À LIRE : docs/product/API.md §3.14 ; docs/product/README.md §4.
PRODUIRE : endpoints de la file (liste, détail, approuver, rejeter avec motif) ; événements `user.approved` / rejet ; écrans dans apps/backoffice (dossier identity) : file, fiche étudiant, historique ; journal d'audit des décisions.
RÈGLES : rôle admin requis ; toute décision journalisée avec l'auteur ; notification déclenchée via événement (consommée par realtime).
CRITÈRES : - [ ] un non-admin reçoit FORBIDDEN - [ ] approbation → statut `active` et événement - [ ] capture d'écran de la file en preuve.
```

### F1.4 — Fiabilité, blocages, signalements
**Agent** `identity` · **Dépend de** F1.2 · **Taille** M
```text
OBJECTIF : score de fiabilité, blocage entre étudiants, signalements.
À LIRE : docs/product/API.md §3.14 ; docs/product/schema.sql (reliability_events, blocks, reports) ; docs/product/README.md (fiabilité).
PRODUIRE : score 0–100 (départ 70) avec `reliability_events` ; consommation des événements de pénalité (forfait, absence) ; blocage mutuel ; signalements et traitement admin ; seuils d'accès (rencontres ≥ 40, publication d'offres automatique ≥ 60) exposés par API interne ; événements.
RÈGLES : tout changement de score est un événement journalisé avec sa cause ; un blocage masque l'un à l'autre dans les cartes ; barème dans la configuration, pas en dur.
CRITÈRES : - [ ] tests du barème et des seuils - [ ] blocage effectif sur les cartes - [ ] rejeu d'un événement de pénalité sans double effet.
```

### F1.5 — Notifications, push web et WebSocket
**Agent** `realtime` · **Dépend de** F0.5, F1.1 · **Taille** L
```text
OBJECTIF : notifier en temps réel, par push web et dans l'app.
À LIRE : docs/product/API.md §4 (temps réel) et §5 (catalogue de notifications) ; docs/product/schema.sql (§4) ; docs/STACK.md.
PRODUIRE : service realtime (WebSocket Socket.IO authentifié par JWT) ; centre de notifications (liste, lu, préférences) ; gabarits français pour le catalogue ; push web VAPID (abonnement, envoi, nettoyage des abonnements morts) ; consommateurs d'événements du catalogue (à étendre au fur et à mesure des domaines) ; reprise après échec d'envoi ; écrans du centre de notifications dans apps/web (dossier realtime).
RÈGLES : une notification = un type du catalogue ; respect des préférences ; idempotence par événement ; aucun contenu sensible dans la charge du push ; limites de débit.
CRITÈRES : - [ ] notification reçue en push et en WebSocket dans un test e2e - [ ] événement rejoué = une seule notification - [ ] reconnexion sans doublon.
DÉCOUPAGE : socle WebSocket / notifications internes / push / écrans.
```

### F1.6 — Écrans d'inscription, d'attente et de profil
**Agent** `identity` · **Dépend de** F1.2, F0.7 · **Taille** M
```text
OBJECTIF : le parcours d'entrée côté étudiant.
À LIRE : docs/product/README.md §16 ; docs/product/API.md §3.1.
PRODUIRE : écrans (auth) : saisie du numéro, saisie du code, inscription en étapes avec photo, écran d'attente de validation, profil et modification, blocages ; textes français en clés i18n ; erreurs métier traduites ; tests de composants et un test Playwright du parcours.
RÈGLES : mobile d'abord ; aucune règle dupliquée côté front ; photo compressée côté client avant envoi ; aucun numéro dans l'analytique.
CRITÈRES : - [ ] parcours complet jusqu'à l'attente de validation en e2e - [ ] états de chargement, d'erreur et vide - [ ] captures mobile en preuve.
```

## Vague 2 : Football

### F2.1 — Équipes et effectif
**Agent** `football` · **Dépend de** F1.2 · **Taille** M
```text
OBJECTIF : créer et gérer une équipe.
À LIRE : docs/product/README.md §5 ; docs/product/schema.sql (§3 Football) ; docs/product/API.md §3.2.
PRODUIRE : service football (migrations, contrat) : création d'équipe (nom, filière représentée, niveau), capitaine, effectif, départ d'un joueur, transfert de capitanat ; copie locale des cartes utilisateur (événements identity) ; événements `team.created`, `team.member_joined`, `team.member_left` ; publication de « l'équipe de l'utilisateur » pour identity (trou n°3).
RÈGLES : un joueur = une équipe active (contrainte en base) ; gel de 7 jours après départ ; un seul capitaine ; équipe « active » à partir de 7 joueurs (paramètre de configuration) ; nom d'équipe unique.
CRITÈRES : - [ ] contraintes testées sur vrai PostgreSQL (double adhésion refusée, gel) - [ ] contrat publié avant l'implémentation - [ ] événements conformes.
```

### F2.2 — Invitations et demandes d'adhésion
**Agent** `football` · **Dépend de** F2.1 · **Taille** S
```text
OBJECTIF : recruter des joueurs, dans les deux sens.
À LIRE : docs/product/API.md §3.2 ; docs/product/schema.sql (invitations).
PRODUIRE : invitation par le capitaine, demande d'adhésion par le joueur, acceptation/refus/annulation/expiration, recherche des joueurs sans équipe (copie locale) ; événements pour les notifications.
RÈGLES : un joueur déjà en équipe active ne peut accepter ; invitation expirée refusée ; blocages respectés.
CRITÈRES : - [ ] tests des états et des courses (deux acceptations simultanées) - [ ] notifications émises par événements.
```

### F2.3 — Terrains, défis et matchs
**Agent** `football` · **Dépend de** F2.1 · **Taille** M
```text
OBJECTIF : organiser un match entre deux équipes.
À LIRE : docs/product/README.md §5 ; docs/product/API.md §3.3 ; docs/product/schema.sql (fields, challenges, matches).
PRODUIRE : terrains et créneaux, défi (envoi, acceptation, refus, contre-proposition), création du match, calendrier, annulation, forfait ; événements `match.scheduled`, `match.forfeit`.
RÈGLES : aucun double créneau sur un terrain (contrainte d'exclusion en base) ; seul un capitaine défie ; équipes non actives refusées ; forfait → défaite 0-3 et événement de pénalité de fiabilité.
CRITÈRES : - [ ] test de concurrence sur un même créneau - [ ] `match.scheduled` consommable par realtime pour créer le chat.
```

### F2.4 — Chat des capitaines et filtre anti-chiffres
**Agent** `realtime` · **Dépend de** F1.5, F2.3 · **Taille** M · **Revue** security
```text
OBJECTIF : les deux capitaines discutent, sans pouvoir échanger un numéro.
À LIRE : docs/product/README.md §4.3 et §12 ; docs/product/API.md §3.4 ; docs/product/schema.sql (§4, déclencheur de filtre).
PRODUIRE : création du fil à `match.scheduled` ; envoi/lecture de messages ; filtre serveur : normalisation (Unicode NFKC, minuscules, suppression des séparateurs) puis détection de chiffres 0-9, chiffres Unicode (arabes-indiens, pleine chasse), emojis-chiffres, nombres écrits en lettres (français, anglais), substitutions (o/0, l/1, i/1, s/5), liens, @pseudo, demandes de contact ; déclencheur SQL de défense en profondeur ; sélecteurs d'horaires (pas de texte) ; limite 30 messages/min ; signalement d'un message ; deux corpus versionnés (≥ 200 attaques à bloquer, phrases normales à laisser passer) avec mesure des faux positifs.
RÈGLES : le filtre est serveur, jamais client seul ; ne jamais journaliser le contenu ; blocage d'un utilisateur = fin d'accès au fil ; message refusé = code d'erreur du contrat avec motif générique (ne pas dire quel mot a déclenché).
CRITÈRES : - [ ] 100 % du corpus d'attaques bloqué, taux de faux positifs publié dans la PR - [ ] test du déclencheur SQL en contournant l'application - [ ] écran de chat avec capture.
HORS PÉRIMÈTRE : chat libre des projets (F5.4). RELECTEURS : security.
```

### F2.5 — Déclaration du score, validation, litiges, Elo
**Agent** `football` · **Dépend de** F2.3 · **Taille** L
```text
OBJECTIF : des résultats crédibles et un classement Elo juste.
À LIRE : docs/product/README.md §5 ; docs/product/schema.sql (match_reports, fonctions de validation et Elo) ; docs/product/API.md §3.3 et §3.5.
PRODUIRE : déclaration séparée par chaque capitaine (score, buteurs, passeurs) ; concordance exacte → match validé ; divergence → litige ; une seule déclaration après 24 h → validation provisoire contestable 48 h ; arbitrage admin ; calcul Elo ; événements `match.validated`, `match.disputed` ; tâches planifiées pour les délais.
RÈGLES : Elo départ 1000, E = 1/(1+10^((Rb−Ra)/400)), K = 48 pour les 5 premiers matchs puis 32, victoire 1 / nul 0,5 / défaite 0, plancher 100, non classé pendant 3 matchs ; **l'Elo ne peut être appliqué qu'une fois par match** (verrou + contrainte) ; aucune modification de l'Elo hors de la fonction de validation.
CRITÈRES : - [ ] tests unitaires Elo (valeurs de référence, plancher, K variable, nul) - [ ] test d'intégration : double validation concurrente = un seul effet - [ ] litige tranché met l'Elo à jour une seule fois.
DÉCOUPAGE : déclarations / validation / Elo / délais et litiges.
```

### F2.6 — Statistiques joueurs, MVP, classements, badges
**Agent** `football` · **Dépend de** F2.5 · **Taille** M
```text
OBJECTIF : classements d'équipes et de joueurs, MVP, badges.
À LIRE : docs/product/README.md §5 ; docs/product/schema.sql (vues de statistiques, mvp_votes, badges) ; docs/product/API.md §3.5.
PRODUIRE : statistiques par joueur (buts, passes, matchs, MVP), classements (école, filière, niveau, saison), vote MVP, attribution de badges, événement `badge.awarded` ; ADR de la fenêtre de vote du MVP (trou n°7, proposition 24 h).
RÈGLES : le MVP est voté uniquement par les joueurs de l'équipe adverse ; un vote par joueur et par match ; classement des équipes non classées séparé ; aucune statistique avancée vendue qui modifie le classement officiel.
CRITÈRES : - [ ] vote d'un coéquipier refusé - [ ] clôture de la fenêtre testée avec horloge simulée - [ ] classements cohérents avec les matchs validés.
```

### F2.7 — Écrans football
**Agent** `football` · **Dépend de** F2.1, F0.7 · **Taille** L
```text
OBJECTIF : l'expérience football côté étudiant.
À LIRE : docs/product/README.md §5 et §16 ; docs/product/API.md §3.2–3.6.
PRODUIRE : écrans (app)/football : mon équipe, créer/rejoindre, invitations, défier, calendrier, chat du match (composant fourni par realtime), saisie du score et des buteurs, litige, classements équipes et joueurs, fiche joueur, historique, vote MVP, compétitions ; textes en clés i18n ; tests de composants et parcours Playwright.
RÈGLES : mobile d'abord ; aucune règle d'Elo ni de gel côté front ; états de chargement/erreur/vide ; ajout de navigation par fichier nav.ts, pas d'édition de fichier partagé.
CRITÈRES : - [ ] parcours créer équipe → défi → score en e2e - [ ] captures mobile en preuve.
DÉCOUPAGE : équipe / matchs / classements.
```

### F2.8 — Litiges et terrains : écrans back-office
**Agent** `football` · **Dépend de** F2.5, F0.9 · **Taille** S
```text
OBJECTIF : outils d'arbitrage pour les admins.
À LIRE : docs/product/API.md §3.14 ; docs/product/schema.sql (match_reports, disputes).
PRODUIRE : écrans (admin)/football : litiges (déclarations côte à côte, décision), terrains et créneaux, équipes, classements ; journal d'audit des décisions.
RÈGLES : rôle admin ; toute décision a un auteur et un motif ; l'Elo est mis à jour par l'API, pas par le front.
CRITÈRES : - [ ] décision de litige → match validé et Elo à jour (e2e) - [ ] captures.
```

### F2.9 — Compétitions (poules, phases finales)
**Agent** `football` · **Dépend de** F2.5 · **Taille** M
```text
OBJECTIF : tournois organisés par l'école.
À LIRE : docs/product/README.md §5 ; docs/product/schema.sql (competitions) ; docs/product/API.md §3.6.
PRODUIRE : création de compétition (admin), inscription des équipes, tirage des poules, calendrier, classement de poule, phases à élimination directe, résultats liés aux matchs ; écrans étudiant et admin.
RÈGLES : un match de compétition suit la même validation que les autres ; départage défini (points, différence, buts) et testé ; l'Elo s'applique ou non selon le paramètre de la compétition (à fixer par ADR).
CRITÈRES : - [ ] tirage et classement testés sur cas connus - [ ] bascule poules → élimination directe testée.
```

---

## Vague 3 : Argent

> Tout F3.x est **validé par un humain**, avec revue `security`. Voir `docs/STACK.md` §3 pour ce qui est confirmé et non confirmé chez Campay.

### F3.1 — Payments : grand livre, paiements, idempotence
**Agent** `money` · **Dépend de** F0.5 · **Taille** L · **Validation humaine** oui
```text
OBJECTIF : le cœur financier indépendant du fournisseur.
PRÉREQUIS : ADR du grand livre à DOUBLE ÉCRITURE (trou n°1) soumis à l'humain AVANT le code : comptes (séquestre, plateforme, bénéficiaires, frais), écritures équilibrées, règles d'immutabilité.
À LIRE : docs/product/schema.sql (§7) ; docs/product/API.md §3.13 ; docs/product/ARCHITECTURE.md §6–7 ; docs/STACK.md §3.3.
PRODUIRE : service payments : table de paiements avec machine à états (pending → escrow → released | refund_pending → refunded | failed), grand livre, `Idempotency-Key`, interface `PaymentProvider` et `FakeProvider` (réussite, échec, délai, webhook en double, webhook perdu configurables), événements `payment.*`, consommation des demandes de paiement des domaines.
RÈGLES : montants entiers FCFA ; somme des écritures = 0 par transaction (contrainte) ; un paiement ne change d'état que par transitions autorisées ; aucune écriture modifiée ou supprimée (corrections par contre-passation) ; aucune PII dans les journaux.
CRITÈRES : - [ ] propriétés testées : équilibre des écritures, idempotence, transitions interdites - [ ] test de concurrence sur la même clé d'idempotence - [ ] crash simulé au milieu d'un paiement : reprise cohérente.
DÉCOUPAGE : ADR / grand livre / machine à états / API et événements / FakeProvider.
```

### F3.2 — Adaptateur Campay : collecte, statut, webhook, rapprochement
**Agent** `money` · **Dépend de** F3.1 · **Taille** L · **Validation humaine** oui
```text
OBJECTIF : brancher Campay derrière `PaymentProvider`.
PRÉREQUIS : l'humain a vérifié les points « non confirmés » de docs/STACK.md §3.2 (URLs, webhook, frais, remboursement). Sinon : écris docs/vendor/campay.md avec ce qui est confirmé et la liste des questions, implémente ce qui est sûr, laisse le reste derrière un drapeau, arrête-toi.
À LIRE : docs/STACK.md §3 ; docs/vendor/campay.md ; documentation officielle Campay fournie par l'humain.
PRODUIRE : CampayProvider : jeton (permanent ou temporaire), `initCollect` (téléphone 237…, montant entier, external_reference = notre identifiant de paiement), lecture du statut, webhook, polling de secours, décaissement, solde par opérateur, mapping des codes d'erreur (ER101, ER102, ER201, ER301…), rapprochement quotidien du grand livre avec le solde ; tests de contrat contre des réponses enregistrées ; test d'intégration contre l'environnement DEV de Campay, jamais en CI.
RÈGLES : ne jamais croire un webhook seul : relire le statut par l'API ; webhooks idempotents (clé unique) ; MTN et Orange uniquement ; aucune clé en dépôt ; expiration d'un paiement non confirmé ; tout écart de rapprochement alerte.
CRITÈRES : - [ ] webhook en double, perdu, falsifié : états corrects - [ ] polling rattrape un webhook perdu - [ ] aucun appel réseau réel en CI - [ ] journaux sans numéro de téléphone.
```

### F3.3 — Séquestre, remboursements, reversements
**Agent** `money` · **Dépend de** F3.2 · **Taille** L · **Validation humaine** oui
```text
OBJECTIF : garder l'argent en attente, le rendre ou le verser.
PRÉREQUIS : ADR du crédit restaurant (trou n°4) ; colonne du numéro de reversement côté partners (trou n°2, via deps_request vers l'agent partners).
À LIRE : docs/product/ARCHITECTURE.md §6–7 ; docs/product/API.md §3.13 ; docs/STACK.md §3.3.
PRODUIRE : séquestre par écritures ; libération avec ventilation (bénéficiaire, commission, frais) ; remboursement par décaissement vers le payeur ; reversements par bénéficiaire et par opérateur avec vérification de solde ; endpoint de saisie du numéro de reversement (distinct du WhatsApp) ; tentatives et reprise des décaissements ; événements `payment.released|refunded`, `payout.sent|failed` ; tableau des remboursements à traiter pour l'admin.
RÈGLES : un remboursement ne peut pas être répété ; un montant libéré ne change plus sans contre-passation ; solde insuffisant = mise en attente et alerte, jamais d'échec silencieux ; commission figée à la création de l'objet payé.
CRITÈRES : - [ ] échecs injectés : décaissement refusé, solde insuffisant, redémarrage en cours de reversement - [ ] rapprochement à zéro après un scénario complet - [ ] double demande de remboursement = un seul décaissement.
```

### F3.4 — Billing : plans, abonnements, droits
**Agent** `money` · **Dépend de** F3.1 · **Taille** L · **Validation humaine** oui
```text
OBJECTIF : abonnements Pro et droits lisibles par tous.
À LIRE : docs/product/schema_extension.sql (§1 Billing) ; docs/product/API.md §3.16 et §3.18 ; docs/product/ARCHITECTURE.md §7.
PRODUIRE : service billing : plans (Étudiant Plus, Équipe Pro, Organisateur Pro, Vendeur Pro, Partenaire…), prix et capacités, abonnements (pending_payment → active → grace → expired/cancelled), 3 jours de grâce, factures, codes promo, droits effectifs (grants > plan payant le plus cher > plan gratuit), API interne des droits, `packages/entitlements` (client avec cache 60 s), événement `entitlements.changed` à chaque modification, saga d'achat avec payments.
RÈGLES : aucun abonnement n'augmente les swipes, les invitations ou le classement sportif ; le plan gratuit reste utile ; les consommateurs lisent les droits, jamais de valeur en dur ; prix validés par l'humain.
CRITÈRES : - [ ] expiration et grâce testées avec horloge simulée - [ ] achat échoué = aucun droit - [ ] changement de droits visible chez un consommateur en moins de 60 s ou à réception de l'événement.
```

### F3.5 — Écrans d'abonnement, de paiement et de finance admin
**Agent** `money` · **Dépend de** F3.3, F3.4, F0.9 · **Taille** M
```text
OBJECTIF : les écrans de l'argent.
À LIRE : docs/product/API.md §3.13 et §3.16 ; docs/product/README.md §16.
PRODUIRE : étudiant : plans, achat, état « paiement en attente de confirmation sur votre téléphone », factures, page d'équipe Pro, saisie du numéro de reversement ; back-office : finance, rapprochement, remboursements à traiter, plans, codes promo.
RÈGLES : le front n'affiche que ce que le serveur autorise ; état d'attente avec reprise si l'étudiant ferme l'app ; aucun numéro de téléphone dans l'analytique ; libellés clairs sur les montants en FCFA.
CRITÈRES : - [ ] parcours d'achat sur FakeProvider en e2e (réussite, échec, expiration) - [ ] captures mobile.
```

## Vague 4 : Partenaires, restaurant, rencontres

### F4.1 — Partners : organisations, contrats, lieux, menu, formules, créneaux
**Agent** `partners` · **Dépend de** F1.2 · **Taille** L
```text
OBJECTIF : le restaurant et les autres partenaires existent dans le système.
À LIRE : docs/product/schema.sql (§5 Restaurant) ; docs/product/schema_extension.sql (§3 Partners) ; docs/product/API.md §3.9 et §3.17 ; docs/product/ARCHITECTURE.md §8.
PRODUIRE : service partners : organisations (type restaurant, commerçant, sponsor…), candidatures et approbation admin, contrats versionnés (un seul actif), lieux, menu, formules à prix plafonné, tables et créneaux, retenue de créneau de 15 minutes (`slot.held`, `slot.rejected`, `slot.released`), routes `/restaurant/*` inchangées (restaurant_id = venue_id), colonne du numéro de reversement (trou n°2), événements.
RÈGLES : commission 10 % figée à la réservation (instantané du contrat) ; la retenue expire seule ; aucun numéro WhatsApp ni matricule stocké ; un seul contrat actif par organisation.
CRITÈRES : - [ ] concurrence sur la dernière table d'un créneau - [ ] libération automatique d'une retenue expirée - [ ] compatibilité des routes /restaurant/* avec API.md.
```

### F4.2 — Portail restaurant
**Agent** `partners` · **Dépend de** F4.1, F0.9 · **Taille** L
```text
OBJECTIF : le personnel du restaurant gère les dates sur téléphone.
À LIRE : docs/product/README.md §8 ; docs/product/API.md §3.9.
PRODUIRE : apps/partner-portal (dossier restaurant) : tableau du jour, réservations et commandes, check-in (prénom et photo seulement), service, SOS reçu en direct (WebSocket de realtime), gestion du menu, des formules et des créneaux, finances (montants dus, reversements) ; textes français ; tests.
RÈGLES : le restaurant ne voit jamais WhatsApp ni matricule ; SOS bien visible et accusé de réception ; utilisable sur petit écran en service ; rôles du personnel.
CRITÈRES : - [ ] parcours check-in → service en e2e - [ ] SOS affiché en moins de 2 s en test - [ ] captures téléphone.
DÉCOUPAGE : tableau du jour / catalogue / finances.
```

### F4.3 — Questionnaire de rencontre et embeddings
**Agent** `dating`, `ai` · **Dépend de** F1.2, F0.5 · **Taille** L
```text
OBJECTIF : profil de rencontre et vecteurs.
PRÉREQUIS : ADR de l'agent `ai` sur la construction des vecteurs (trou n°8) avant de coder l'encodage.
À LIRE : docs/product/README.md §6 et §11 ; docs/product/schema.sql (§6) ; docs/product/API.md §3.7.
PRODUIRE : dating : questionnaire (valeurs, personnalité, mode de vie, préférences), accès (18 ans, fiabilité ≥ 40, charte), stockage, événement `dating.embedding_requested`, drapeau `dating_pilot`. ai : service Python, consommateur de `dating.embedding_requested`, trois vecteurs (64 dimensions par bloc), publication de `embedding.computed`, version de modèle, idempotence, modèle factice pour la CI. Écrans reportés à F4.7.
RÈGLES : texte d'utilisateur = donnée, jamais instruction ; vecteurs non journalisés ; rejeu = même résultat ; âge calculé par identity.
CRITÈRES : - [ ] encodage déterministe testé - [ ] rejeu idempotent - [ ] accès refusé aux mineurs et sous le seuil de fiabilité.
```

### F4.4 — Propositions hebdomadaires et invitations
**Agent** `dating`, `ai` · **Dépend de** F4.3 · **Taille** M
```text
OBJECTIF : 3 propositions par semaine et 3 invitations maximum.
À LIRE : docs/product/README.md §6 ; docs/product/schema.sql (match_candidates, invitations) ; docs/product/API.md §3.7.
PRODUIRE : génération hebdomadaire (2 « ressemblants » + 1 « complémentaire ») par similarité cosinus pgvector pondérée ; filtres (âge, préférences, blocages, quarantaine, déjà vus) ; invitations ; réponses sans révéler un refus à l'émetteur ; quarantaine de 60 jours après un refus ; tâche planifiée ; mesure d'équité (taux de « oui » par segment) par ai.
RÈGLES : quotas jamais augmentés par un abonnement ; un refus n'est jamais montré comme tel ; propositions stables pour la semaine.
CRITÈRES : - [ ] quotas, quarantaine et filtres testés - [ ] génération reproductible avec jeu de données connu - [ ] aucun accès à un autre schéma.
```

### F4.5 — Négociation par cartes et saga de réservation d'un date
**Agent** `dating` · **Dépend de** F4.4, F4.1, F3.3 · **Taille** L
```text
OBJECTIF : de l'acceptation de l'invitation à la réservation payée.
À LIRE : docs/product/README.md §6 ; docs/product/API.md §3.7–3.8 ; docs/product/ARCHITECTURE.md §6.1 (saga) ; docs/product/schema.sql (date_cards, dates).
PRODUIRE : négociation par cartes (catalogue fermé de `date_cards`, jamais de texte libre) ; choix de formule et de plat ; saga : `date.hold_requested` → `slot.held` → `date.charge_requested` → `payment.escrowed` → `date.confirmed`, avec compensation (libération du créneau, remboursement) ; `resolvePayer()` pure et testée (le garçon paie la totalité ; autres cas refusés, trou n°6) ; annulation libre jusqu'à 3 h avant ; événements.
RÈGLES : fenêtre de 3 h exacte (2 h 59 permis, 3 h 01 refusé) ; chacun commande pour soi dans la formule plafonnée ; aucune écriture dans la base d'un autre service.
CRITÈRES : - [ ] saga avec échecs injectés (paiement refusé, créneau perdu, expiration de la retenue) - [ ] tests de la fenêtre de 3 h avec horloge simulée - [ ] cas hors garçon/fille refusés avec un code clair.
DÉCOUPAGE : cartes / saga / annulations.
```

### F4.6 — Check-in, SOS, retour, révélation du contact, mise à jour vectorielle
**Agent** `dating`, `ai` · **Dépend de** F4.5 · **Taille** L · **Validation humaine** oui (révélation du contact)
```text
OBJECTIF : vivre le date et conclure.
PRÉREQUIS : ADR du crédit restaurant (trou n°4) décidé en F3.3.
À LIRE : docs/product/README.md §6 ; docs/product/API.md §3.8 ; docs/product/schema.sql (check-ins, feedback, contact_reveals).
PRODUIRE : check-in (photo du partenaire révélée à ce moment), compte à rebours, SOS (alerte restaurant et admin immédiatement), absence (pénalité de fiabilité + compensation de la personne présente), retour des deux personnes, révélation du numéro **seulement si les deux répondent « oui »** via appel interne audité à identity, événement `date.completed`, mise à jour vectorielle côté ai (Rocchio α = 0,1, β = 0,05) puis `dating.vectors_updated`.
RÈGLES : réponses jamais visibles avant que les deux aient répondu ; chaque révélation est auditée ; SOS ne dépend d'aucun paiement ; aucun numéro dans les journaux ni événements.
CRITÈRES : - [ ] « non » d'un côté = aucune révélation, sans que l'autre sache qui a dit non - [ ] audit de chaque révélation - [ ] mise à jour vectorielle testée sur cas connus - [ ] SOS déclenché en e2e vers le portail.
RELECTEURS : security, human.
```

### F4.7 — Écrans rencontres
**Agent** `dating` · **Dépend de** F4.3, F0.7 · **Taille** L
```text
OBJECTIF : l'expérience rencontres côté étudiant.
À LIRE : docs/product/README.md §6 et §16 ; docs/product/API.md §3.7–3.8.
PRODUIRE : écrans (app)/dating : accès et charte, questionnaire, mes 3 propositions, invitations, négociation par cartes, choix de formule et de plat, paiement, mon date (compte à rebours, check-in, SOS), retour, contacts révélés ; clés i18n ; tests de composants et parcours Playwright.
RÈGLES : mobile d'abord ; aucun texte libre dans la négociation ; ne jamais afficher un refus comme refus ; le front n'applique aucune règle de paiement ni de fenêtre (il affiche ce que le serveur dit) ; compte à rebours piloté par l'heure serveur.
CRITÈRES : - [ ] parcours invitation → réservation → retour en e2e sur FakeProvider - [ ] captures mobile.
DÉCOUPAGE : propositions / négociation et paiement / jour du date.
```

### F4.8 — Durcissement avant pilote : sécurité et modération
**Agent** `security`, `qa` · **Dépend de** F4.6 · **Taille** M
```text
OBJECTIF : être prêt à ouvrir le pilote à 50 étudiants.
À LIRE : agents/security/README.md ; agents/qa/README.md ; docs/product/README.md §6 et §12.
PRODUIRE : security : modèle de menaces des rencontres (traque, divulgation de lieu, abus de photo, harcèlement, usurpation, fraude de paiement), revue de F1.1, F2.4, F3.x, F4.5–F4.6, rapport avec constats classés ; qa : parcours e2e du date complet, du forfait, de l'annulation et de l'absence avec horloge simulée, test des quotas ; charte de modération et procédure d'urgence à valider par l'humain (documents, pas du code).
RÈGLES : aucun point bloquant ouvert avant d'activer `dating_pilot` ; les défauts deviennent des tâches pour les agents propriétaires.
CRITÈRES : - [ ] rapport sans bloquant ouvert - [ ] e2e verts en CI - [ ] liste de contrôle d'ouverture du pilote signée par l'humain.
```

---

## Vague 5 : Talents, services, partenariats

### F5.1 — Compétences, publications, candidatures, recommandations
**Agent** `talents`, `ai` · **Dépend de** F1.2, F0.5 · **Taille** L
```text
OBJECTIF : faire se rencontrer besoins et compétences.
À LIRE : docs/product/README.md §7 ; docs/product/schema.sql (§8 Projets) ; docs/product/API.md §3.10–3.11.
PRODUIRE : service talents : profil de compétences, publications (besoin, projet, compétition, offre de service, demande d'aide), candidatures, modération, signalement ; ai : embeddings de compétences et de publications (1536 dimensions), recommandations par similarité cosinus ; événements.
RÈGLES : texte d'utilisateur traité comme donnée par ai ; quotas lus dans les droits (billing) ; aucun accès à un autre schéma.
CRITÈRES : - [ ] recommandations reproductibles sur jeu de données connu - [ ] quotas issus des droits (pas de valeur en dur) - [ ] rejeu d'événement idempotent.
DÉCOUPAGE : publications et candidatures / compétences / recommandations.
```

### F5.2 — Missions avec séquestre et avis
**Agent** `talents` · **Dépend de** F5.1, F3.3 · **Taille** M
```text
OBJECTIF : missions payées en sécurité.
À LIRE : docs/product/API.md §3.11 ; docs/product/ARCHITECTURE.md §6 (saga) ; docs/product/schema.sql (missions, reviews).
PRODUIRE : choix du prestataire par le client, mission, demande de paiement, séquestre, livraison, approbation → libération moins commission (8 % par défaut, lue dans les droits), litige arbitré par un admin, avis réservés aux missions terminées ; événements.
RÈGLES : argent uniquement via payments ; commission figée à la création ; numéro de reversement requis du prestataire avant libération.
CRITÈRES : - [ ] cycle complet sur FakeProvider - [ ] litige : remboursement ou libération par décision admin - [ ] avis refusé hors mission terminée.
```

### F5.3 — Événements, billets, droits Pro
**Agent** `talents` · **Dépend de** F3.3, F3.4 · **Taille** L
```text
OBJECTIF : organiser des événements et vendre des billets.
À LIRE : docs/product/API.md §3.12 et §3.18 ; docs/product/schema.sql (events, tickets).
PRODUIRE : création d'événement, inscription, billets payants et gratuits, QR de contrôle à l'entrée, quota mensuel gratuit (2) et commission de billets (8 %) lus dans les droits, plan Organisateur Pro (statistiques, export, billets avancés), événements `event.ticket_requested`.
RÈGLES : aucun quota ni commission en dur ; billet valable une seule fois ; annulation d'événement → remboursements ; jauge respectée sous concurrence.
CRITÈRES : - [ ] dernier billet vendu une seule fois sous concurrence - [ ] bascule gratuit/Pro testée via droits simulés - [ ] remboursement massif testé sur FakeProvider.
DÉCOUPAGE : événements / billets et contrôle / Pro.
```

### F5.4 — Rencontres « meeter » et messagerie libre
**Agent** `talents`, `realtime` · **Dépend de** F5.1, F1.5 · **Taille** S
```text
OBJECTIF : se parler et se donner rendez-vous pour un projet.
À LIRE : docs/product/API.md §3.4 et §3.10 ; docs/product/README.md §7.
PRODUIRE : fil de discussion libre par projet et direct (realtime, sans filtre de chiffres, avec signalement et anti-spam) ; proposition de lieu et d'heure (meetup) côté talents ; notifications.
RÈGLES : le filtre anti-chiffres reste réservé aux chats de match ; blocage = fin d'accès au fil ; messages journalisés sans contenu.
CRITÈRES : - [ ] un chiffre passe en chat de projet et reste bloqué en chat de match (test) - [ ] signalement et blocage testés.
```

### F5.5 — Marketplace : offres, formules, disponibilités, recherche
**Agent** `marketplace`, `ai` · **Dépend de** F1.2, F3.4 · **Taille** L
```text
OBJECTIF : vendre un service entre étudiants.
À LIRE : docs/product/ARCHITECTURE.md §9 ; docs/product/schema_extension.sql (§2 Marketplace) ; docs/product/API.md §3.15.
PRODUIRE : service marketplace : offres avec trois formules (basic, standard, premium) ; créneaux ; catégories ; termes interdits et catégories sensibles ; mise en ligne automatique si fiabilité ≥ 60 et catégorie non sensible, sinon revue ; quota d'offres et boosts lus dans les droits ; mise en pause (jamais suppression) des offres en excès après rétrogradation ; recherche textuelle et sémantique (ai) ; signalement.
RÈGLES : intégrité académique (`LISTING_PROHIBITED`) ; droits via packages/entitlements ; aucun accès à un autre schéma.
CRITÈRES : - [ ] termes interdits refusés - [ ] rétrogradation → offres en pause - [ ] recherche sémantique reproductible.
```

### F5.6 — Marketplace : commandes, livraison, litiges, avis
**Agent** `marketplace` · **Dépend de** F5.5, F3.3 · **Taille** L
```text
OBJECTIF : commander, payer, livrer, valider.
À LIRE : docs/product/ARCHITECTURE.md §6 et §9 ; docs/product/schema_extension.sql (transition_order) ; docs/product/API.md §3.15.
PRODUIRE : commandes ; machine à états `requested → accepted → funded → in_progress → delivered → completed` avec `revision_requested`, `cancelled`, `disputed`, `refunded` ; paiement en séquestre ; livraison et révisions ; validation automatique 72 h après livraison ; litiges ; avis ; fil de discussion de commande ; événements.
RÈGLES : toute transition passe par la machine à états ; commission figée à la création selon `service_commission_pct` du vendeur (8 % gratuit, 5 % Étudiant Plus) ; avis réservés aux commandes terminées.
CRITÈRES : - [ ] matrice exhaustive de transitions (autorisées et interdites, par acteur) - [ ] validation automatique avec horloge simulée - [ ] commission jamais modifiée après création - [ ] cycle complet sur FakeProvider.
RELECTEURS : security (séquestre).
```

### F5.7 — Offres et bons partenaires
**Agent** `partners` · **Dépend de** F4.1, F3.4 · **Taille** M
```text
OBJECTIF : avantages des commerçants pour les étudiants.
À LIRE : docs/product/schema_extension.sql (§3) ; docs/product/API.md §3.17 ; docs/product/README.md §8.
PRODUIRE : offres validées par un admin, bons (réclamation, QR ou code, consommation unique, expiration ≤ 30 jours, limite par étudiant, stock), condition d'abonnement vérifiée via billing, consommation côté portail ; événements `voucher.redeemed`.
RÈGLES : consommation atomique (un seul succès sous concurrence) ; le partenaire voit prénom et photo seulement ; offre non validée jamais diffusée.
CRITÈRES : - [ ] double consommation simultanée = un seul succès - [ ] expiration et stock testés - [ ] condition d'abonnement testée.
RELECTEURS : security.
```

### F5.8 — Sponsoring, bannières et statistiques
**Agent** `partners` · **Dépend de** F4.1, F3.3, F3.4 · **Taille** L
```text
OBJECTIF : financer la plateforme par des partenaires visibles.
À LIRE : docs/product/schema_extension.sql (§3) ; docs/product/API.md §3.17 et §3.19 ; docs/product/ARCHITECTURE.md §6 (saga de sponsoring).
PRODUIRE : propositions de sponsoring (proposed → negotiating → accepted → paid → active → completed), paiement via payments (sauf sponsoring 100 % en nature), bannières et emplacements, visuels validés par un admin, diffusion seulement si partenaire actif, contrat actif et visuel approuvé, statistiques d'affichage et de clic sans PII, rapports pour le partenaire.
RÈGLES : aucune diffusion sans validation ; statistiques agrégées uniquement ; événements `sponsorship.paid|activated`.
CRITÈRES : - [ ] bannière non servie si l'une des trois conditions manque - [ ] parcours de sponsoring complet sur FakeProvider - [ ] aucune PII dans les statistiques.
```

### F5.9 — Écrans talents et marketplace
**Agent** `talents`, `marketplace` · **Dépend de** F5.1, F5.5, F0.7 · **Taille** L
```text
OBJECTIF : les écrans de la communauté et des services.
À LIRE : docs/product/README.md §7 et §16 ; docs/product/API.md §3.10–3.12, §3.15.
PRODUIRE : (app)/community : fil des besoins, publier, compétences, recommandations, candidatures, missions, événements, billets, meetups ; (app)/services : catalogue, recherche, fiche d'offre, commande, suivi, livraison, litige, avis, tableau de bord vendeur ; back-office : modération, offres à valider, litiges ; clés i18n ; tests.
RÈGLES : mobile d'abord ; limites et commissions affichées depuis les droits du serveur ; agents `talents` et `marketplace` écrivent chacun dans son propre dossier.
CRITÈRES : - [ ] parcours commande → avis en e2e - [ ] captures mobile.
DÉCOUPAGE : un lot par agent, dossiers distincts.
```

### F5.10 — Écrans offres, bons et sponsoring
**Agent** `partners` · **Dépend de** F5.7, F5.8, F0.7 · **Taille** M
```text
OBJECTIF : les écrans des partenariats.
À LIRE : docs/product/README.md §8 et §16 ; docs/product/API.md §3.17 et §3.19.
PRODUIRE : étudiant : offres et bons (QR) ; portail : offres, bons, consommation, sponsoring, bannières, statistiques ; back-office : candidatures, contrats, offres, visuels.
RÈGLES : le portail ne montre que prénom et photo ; mobile d'abord ; états de chargement/erreur/vide.
CRITÈRES : - [ ] parcours bon réclamé → consommé en e2e - [ ] captures.
```

---

## Vague 6 : Lancement

### F6.1 — Suites de bout en bout des parcours critiques
**Agent** `qa` · **Dépend de** F2.7, F4.7, F5.9 · **Taille** L
```text
OBJECTIF : prouver les six parcours critiques.
À LIRE : agents/qa/README.md ; docs/ROADMAP.md (sorties de vague).
PRODUIRE : tests/e2e Playwright : (1) inscription → validation → connexion ; (2) équipe → défi → match → score → Elo ; (3) date complet ; (4) commande de service ; (5) abonnement → droits → expiration ; (6) bon partenaire ; environnement éphémère en CI ; horloge simulée ; rapports de défauts sous forme de tâches reproductibles.
RÈGLES : tests déterministes ; aucun test instable toléré ; aucun identifiant Campay réel.
CRITÈRES : - [ ] six parcours verts en CI - [ ] temps total de la suite documenté.
```

### F6.2 — Tests de charge et de résilience
**Agent** `qa`, `platform` · **Dépend de** F6.1 · **Taille** M
```text
OBJECTIF : savoir ce que le système supporte et comment il échoue.
À LIRE : docs/STACK.md §5 ; docs/runbooks.
PRODUIRE : scénarios de charge (connexions WebSocket, pic de saisie de scores après les matchs, paiements simulés, pic d'ouverture des propositions) ; essais de panne (RabbitMQ, Redis, PostgreSQL redémarrés, webhook retardé) ; résultats et limites documentés ; correctifs demandés aux agents propriétaires.
RÈGLES : jamais contre la production ni contre Campay réel.
CRITÈRES : - [ ] seuils chiffrés dans un rapport - [ ] aucune perte de message ni double paiement après panne.
```

### F6.3 — Revue de sécurité complète et protection des données
**Agent** `security` · **Dépend de** F6.1 · **Taille** L
```text
OBJECTIF : audit avant la bêta.
À LIRE : agents/security/README.md ; docs/STACK.md §8 ; tous les modèles de menaces existants.
PRODUIRE : revue de bout en bout (autorisation et IDOR, PII, argent, sessions, filtre de chat, bons, révélation de contact, dépendances, secrets, conteneurs, rôles de base de données) ; registre des données personnelles (qui, quoi, pourquoi, durée) ; procédure de suppression et d'export ; plan de correction classé.
RÈGLES : aucun point bloquant ouvert avant la bêta ; reproductions fournies ; aucun test contre un environnement qui n'est pas un environnement de test.
CRITÈRES : - [ ] rapport complet - [ ] zéro bloquant ouvert - [ ] registre des données validé par l'humain.
```

### F6.4 — Sauvegardes, runbooks et alertes
**Agent** `platform` · **Dépend de** F0.6 · **Taille** M · **Validation humaine** oui
```text
OBJECTIF : ne pas perdre de données et savoir réagir.
À LIRE : docs/STACK.md §5 ; docs/runbooks/observability.md.
PRODUIRE : sauvegardes PostgreSQL chiffrées (complètes + journaux) et test de restauration automatisé ; runbooks : incident de paiement, écart de rapprochement, panne du bus, rotation de secrets, restauration, SOS manqué ; alertes réelles reliées à une personne ; configuration de préproduction.
RÈGLES : la restauration est testée pour de vrai ; aucun secret en clair ; deploy/ validé par un humain.
CRITÈRES : - [ ] restauration réussie sur environnement vierge, durée mesurée - [ ] alerte de test reçue par un humain.
```

### F6.5 — Manifestes Kubernetes (en perspective, optionnel)
**Agent** `platform` · **Dépend de** F6.4 · **Taille** M · **Validation humaine** oui
```text
OBJECTIF : préparer la migration vers Kubernetes sans l'imposer.
À LIRE : docs/STACK.md §5 ; docs/product/ARCHITECTURE.md §10.
PRODUIRE : charts Helm ou manifestes Kustomize par déployable (gateway, core, money, realtime, ai-worker), sondes de santé, ressources, autoscaling du temps réel, secrets externes, Ingress ; document de décision « quand passer à Kubernetes » avec critères mesurables.
RÈGLES : le déploiement Docker reste la voie principale tant que les critères ne sont pas atteints.
CRITÈRES : - [ ] déploiement réussi sur un cluster local de test - [ ] critères de bascule écrits.
```

### F6.6 — Bêta fermée : instrumentation et boucle de retours
**Agent** `orchestrator`, `qa` · **Dépend de** F6.1, F6.3 · **Taille** S
```text
OBJECTIF : apprendre de vrais étudiants.
À LIRE : docs/product/README.md (indicateurs) ; agents/orchestrator/README.md.
PRODUIRE : plan de bêta (cohorte, durée, critères de réussite et d'arrêt) ; indicateurs sans PII (inscriptions, équipes actives, matchs validés, taux de « oui » par segment, annulations, litiges, paiements réussis) ; canal de retours ; tri hebdomadaire des retours en tâches ; point de décision humain pour ouvrir `dating_pilot` et pour élargir.
RÈGLES : consentement explicite ; aucune donnée personnelle dans les indicateurs ; arrêt possible à tout moment par l'humain.
CRITÈRES : - [ ] tableau d'indicateurs alimenté - [ ] première boucle de retours bouclée en tâches.
```
