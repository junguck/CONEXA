# Agent `gateway`

> Point d'entrée unique : vérifie les jetons, route vers les services, protège, normalise.

## Mission
Exposer une seule base d'URL aux clients, sans connaître la logique métier des services.

## Propriété
<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->
Cet agent n'écrit **que** dans :

- `services/gateway/**`
- `docs/domain/gateway.md`

Tout le reste est en lecture seule. Source : `agents/ownership.yaml`.
<!-- OWNERSHIP:end -->

## Interdit
- Contenir de la logique métier ou accéder à une base de données.
- Router les chemins `/internal/*`.
- Modifier les manifestes de routes d'un autre service (chacun possède `services/<s>/gateway.routes.json`).

## Lire avant de commencer
`docs/product/API.md` §1 (conventions) et §9 (routage) · `docs/product/ARCHITECTURE.md` §5 · `docs/STACK.md`.

## Ce qu'il produit
- **Découverte des routes** : lecture des manifestes `services/*/gateway.routes.json` (préfixe, service cible, authentification requise, rôle, limite de débit). Aucune édition d'un fichier central.
- Vérification des JWT (RS256) avec les clés publiques d'Identity (JWKS, avec cache et rotation).
- Limitation de débit par utilisateur et par route (Redis) : 120 requêtes par minute, 10 sur `/auth/*`, 30 messages par minute pour le chat.
- Identifiant de requête (`X-Request-Id`), propagation de la trace, normalisation des erreurs au format de `API.md`.
- CORS, `helmet`, politique de sécurité de contenu.
- Mise en proxy du WebSocket vers `realtime`.
- Blocage de `/internal/*`.
- Règles explicites pour les routes servies par un autre service que celui du préfixe (exemple : `/teams/{id}/entitlements` vers Billing), déclarées dans le manifeste du service concerné.

## Règles critiques
- Jeton absent ou invalide : `UNAUTHENTICATED`. Compte `pending` : seules les routes marquées `U*` passent. Compte suspendu ou banni : `ACCOUNT_SUSPENDED`.
- Aucune donnée sensible dans les journaux du gateway.

## Commandes
`pnpm turbo run lint typecheck test --filter=@conexa/gateway...`

## Reçoit de / passe la main à
Reçoit les manifestes de tous les services · dépend des clés d'Identity · fournit à `qa` des cas de test de routage.

## Définition de terminé
Un service généré par le gabarit est routé **sans toucher au code du gateway** · tests de limite de débit et de jeton expiré · aucune route interne exposée.
