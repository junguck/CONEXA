# Domaine : identity

Authentification, comptes, profils, validation admin, fiabilité (`docs/product/API.md` §3.1 et §3.14). Propriétaire : agent `identity`.

## Règles appliquées

- **Numéro WhatsApp** : format `+237[6-9]XXXXXXXX` uniquement ; jamais renvoyé en clair (`whatsapp_masked`), jamais journalisé (pino masque `whatsapp` et `phone`).
- **OTP** : 6 chiffres, HMAC-SHA256 avec `OTP_HASH_SECRET`, 5 minutes, 5 essais, consommé une seule fois. En développement, `ConsoleOtpSender` affiche le code masqué dans les journaux ; aucun envoi réel. Le fournisseur WhatsApp reste à trancher (ADR avant F1.1 en production).
- **JWT** : RS256 signé par Identity, 15 minutes par défaut, `sub`/`roles`/`status`, JWKS exposé sur `GET /.well-known/jwks.json` pour le gateway.
- **Rafraîchissement** : jeton opaque aléatoire, haché en base, rotation à chaque usage ; un jeton déjà tourné rejoué révoque **toute la famille**.
- **Inscription** : `pending` jusqu'à validation d'un admin ; un matricule en double renvoie `MATRICULE_TAKEN`.
- **États** : `pending`, `active`, `suspended`, `banned`, `deleted` (`assertCanUseApp`).

## Endpoints v1

`POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/refresh`, `POST /auth/logout`, `POST /me/register`, `GET/PATCH /me`, `GET /me/reliability`, `GET /filieres`, `GET /users/{id}`, `POST /reports`, `GET /admin/users`, `POST /admin/users/{id}/approve|reject`, `GET /.well-known/jwks.json`.

Route interne, non routée par la Gateway (qui bloque tout `/internal/*`) : `GET /internal/users/{id}/contact` avec l’en-tête `x-service-token`. Elle renvoie `{ user_id, whatsapp, status }` et sert à Dating pour révéler un numéro après accord mutuel : le numéro ne quitte jamais Identity en dehors de cet appel. Sans `SERVICE_TOKEN` configuré, la route répond `403` avec un message explicite plutôt qu’une valeur inventée.

## Appels sortants

Aucun en v1. `SERVICE_TOKEN` est le seul secret partagé entre services ; il se génère par environnement (`openssl rand -hex 32`) et n’est jamais versionné.

## Hors périmètre v1

Notifications et push, suppression/anonymisation RGPD complète, OTP WhatsApp réel, écrans, gestion fine des rôles.

## Données

Schéma `identity` : `profiles`, `filieres`, `otp_codes`, `refresh_tokens`, `admin_actions`, `blocks`, `reports`, `reliability_events`. Migration reconstituée (ADR 0003), à valider.
