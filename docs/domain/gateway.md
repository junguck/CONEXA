# Domaine : gateway

Point d'entrée unique de l'API (`docs/product/API.md` §9). Propriétaire : agent `gateway`.

## Rôle

- Routage vers les services à partir des manifestes `services/<service>/gateway.routes.json`.
- Vérification des JWT RS256 (clé publique locale ou JWKS d'Identity, cache et rotation par `jose`).
- Limitation de débit : 120 req/min/utilisateur, 10 req/min sur `/auth/*`, `429` + `Retry-After`.
- Normalisation des erreurs (`@conexa/service-kit`), `X-Request-Id` et `traceparent` propagés.
- `/internal/*` est refusé depuis l'extérieur ; les en-têtes `x-user-*` fournis par le client sont supprimés puis reconstruits.

## Manifeste

```json
{
  "service": "identity",
  "base_path": "",
  "upstream": "http://localhost:3001",
  "internal": false,
  "routes": [
    { "method": "POST", "path": "/auth/otp/request", "auth": false },
    { "method": "GET", "path": "/me", "auth": true }
  ]
}
```

`base_path` préfixe les chemins ; `:id` et `*` sont acceptés. Ajouter un service consiste à déposer son manifeste : aucun code du gateway ne change.

## Limites connues de la v1

- Limiteur **en mémoire** : chaque instance a son compteur. Redis (`REDIS_URL`) et l'adaptateur partagé arrivent avec la tâche d'infrastructure.
- Pas de proxy WebSocket (service realtime absent de la v1).
- Pas d'agrégation BFF : le gateway ne compose pas de réponses.
