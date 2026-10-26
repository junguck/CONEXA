# Agent `identity`

> Authentification, comptes, profils, fiabilité, blocages, signalements, validation par l'admin.

## Mission
Savoir qui est chaque étudiant, de façon vérifiée et protégée, et fournir cette identité aux autres services sans jamais divulguer ses données sensibles.

## Propriété
<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->
Cet agent n'écrit **que** dans :

- `services/identity/**`
- `db/migrations/identity/**`
- `packages/contracts/src/identity/**`
- `packages/events/src/identity/**`
- `apps/web/src/app/(auth)/**`
- `apps/web/src/app/(app)/identity/**`
- `apps/web/src/features/identity/**`
- `apps/backoffice/src/app/(admin)/identity/**`
- `apps/backoffice/src/features/identity/**`
- `docs/domain/identity.md`

Tout le reste est en lecture seule. Source : `agents/ownership.yaml`.
<!-- OWNERSHIP:end -->

## Interdit
- Exposer le numéro WhatsApp ou le matricule dans une réponse publique, un événement ou un journal.
- Modifier les chemins d'un autre domaine.
- Choisir seul le fournisseur d'OTP : ADR soumis à l'humain.

## Lire avant de commencer
`docs/product/README.md` §4 · `docs/product/schema.sql` (§2 Identité) · `docs/product/API.md` §3.1 et §3.14 · `docs/domain/identity.md`.

## Règles métier critiques
- Un compte par matricule ; matricule et WhatsApp uniques.
- **Âge** : 15 ans minimum pour s'inscrire, 18 ans pour la rencontre (le calcul exact vit ici, la règle est appliquée par `dating`).
- Statuts : `pending` → `active` ; `suspended`, `banned`. Un compte `pending` accède seulement à l'inscription et à son profil.
- OTP : stocké haché, expiration 5 minutes, 5 essais, plafond quotidien par numéro, limite de débit.
- JWT RS256 d'une heure + jeton de rafraîchissement **à rotation** avec détection de réutilisation ; clés publiques en JWKS.
- Fiabilité de 0 à 100 (départ 70) ; tout changement est journalisé dans `reliability_events`.
- Suppression de compte : anonymisation et événement `user.deleted`.
- **Révélation de contact** : le numéro n'est lu que par un appel interne du service `dating`, **audité**.

## Événements produits
`user.created`, `user.approved`, `user.updated`, `user.suspended`, `user.banned`, `user.deleted` · il consomme `match.forfeit`, `date.no_show` et autres pour la fiabilité.

## Écrans (ses dossiers front)
Connexion par code, inscription, attente de validation, profil, blocages ; côté back-office : file de validation, signalements, profil d'utilisateur.

## Commandes
`pnpm turbo run lint typecheck test --filter=@conexa/identity...` · `pnpm test:integration --filter=@conexa/identity`

## Reçoit de / passe la main à
Fournit `user_cards` (événements) et le JWKS à tous · reçoit les pénalités de fiabilité de football et dating.

## Définition de terminé
Tests de force brute, rejeu, expiration et rotation de jeton · aucune donnée sensible dans les journaux (test automatique) · couverture des codes d'erreur de `API.md` §3.1.

## Validation humaine
Toute modification de `services/identity/src/auth/**` (chemin sensible).
