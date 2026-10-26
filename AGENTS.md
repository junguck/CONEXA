# AGENTS.md : règles pour tous les agents et développeurs

Convexa est une super-app de campus : football inter-équipes, rencontres par dates au restaurant, bourse aux talents et services entre étudiants, partenariats. PWA Next.js, services NestJS, PostgreSQL + pgvector, RabbitMQ, Redis, Campay pour les paiements. Monorepo pnpm + Turborepo.

**Si tu es un agent** : lis d'abord `agents/<ton-nom>/README.md`, puis le fichier de ta tâche dans `tasks/`, puis les documents listés dans `reads`.

## Sources de vérité (dans `docs/product/`)
`README.md` (produit), `schema.sql` et `schema_extension.sql` (données), `API.md` (contrat), `ARCHITECTURE.md` (services, événements, sagas). En cas de contradiction : **tu t'arrêtes et tu demandes**, tu ne choisis pas seul.

**Deux sources manquent au 2026-10-26** : `docs/product/schema.sql` et `docs/product/README.md`. Ne les invente pas : voir [ADR 0002](docs/decisions/0002-sources-produit-manquantes.md). Maquettes et handoff visuel : `docs/product/design/`.

## Règles d'or
1. N'écris que dans les chemins de ton agent (`agents/ownership.yaml`) et de ta tâche.
2. Contrat d'abord : tout nouvel endpoint ou événement est d'abord un contrat publié par son producteur.
3. Une tâche = une branche = un worktree = une PR. Jamais de commit sur `main`.
4. Tests avant code pour les règles métier. Pas de PR sans preuves.
5. Aucun secret, aucun numéro de téléphone, aucun matricule dans le code, les journaux ou les tests.
6. Aucune dépendance nouvelle sans justification dans la PR.
7. Aucune modification hors tâche. Une idée utile mais hors périmètre va dans les notes de la PR.
8. Tu ne fusionnes pas ta PR. Tu n'accèdes pas à la production.
9. Bloqué, ambigu ou hors de tes chemins : passe la tâche à `blocked`, explique, propose une option, arrête-toi.

## Langues
Code, identifiants, commits, noms de branche : **anglais**. Documentation et textes de l'interface : **français** (clés i18n pour l'interface). Messages d'erreur d'API : codes de `API.md`.

## Commandes (créées par F0.1, F0.2 et F0.5)
État réel de chaque commande : [docs/domain/platform.md](docs/domain/platform.md). Seules `pnpm install`, `lint`, `typecheck`, `test`, `build`, `format`, `docs:verify` et `agents:ownership` existent aujourd'hui.
```
pnpm install
pnpm dev:infra                    # PostgreSQL, Redis, RabbitMQ, stockage objet
pnpm dev                          # infra + services + apps
pnpm turbo run lint typecheck test build --filter=...[origin/main]
pnpm test:integration --filter=@conexa/<paquet>
pnpm db:migrate <service>         # applique les migrations de ce service
pnpm db:codegen <service>         # régénère les types Kysely
pnpm gen:contracts                # régénère OpenAPI et schémas d'événements
pnpm gen:registry                 # régénère les registres de navigation des apps
pnpm new:service <nom>            # crée un service depuis le gabarit
```

## Carte des paquets
`@conexa/<nom>` : `gateway`, `identity`, `football`, `dating`, `talents`, `marketplace`, `partners`, `payments`, `billing`, `realtime`, `ai-worker`, `contracts`, `events`, `messaging`, `errors`, `config`, `ui`, `entitlements`, `testing`, `web`, `partner-portal`, `backoffice`.

## Définition de terminé (toute tâche)
Critères d'acceptation cochés avec preuves · lint, types, tests, build verts · tests d'intégration si SQL, bus ou paiement · contrat et OpenAPI à jour · logs, métriques et traces pour les nouveaux flux · aucun PII dans les logs · `docs/domain/<domaine>.md` à jour · PR remplie selon le modèle.

Voir `agents/README.md` (orchestration), `agents/GIT_WORKFLOW.md` (git) et `docs/STACK.md` (stack et pratiques).
