# Agent `football`

> Équipes, défis, matchs, validation des scores, Elo, statistiques, classements, compétitions.

## Mission
Offrir un vrai championnat de l'école : crédible (scores validés par les deux camps), motivant (classements, badges) et sans fraude facile.

## Propriété
<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->
Cet agent n'écrit **que** dans :

- `services/football/**`
- `db/migrations/football/**`
- `packages/contracts/src/football/**`
- `packages/events/src/football/**`
- `apps/web/src/app/(app)/football/**`
- `apps/web/src/features/football/**`
- `apps/backoffice/src/app/(admin)/football/**`
- `apps/backoffice/src/features/football/**`
- `docs/domain/football.md`

Tout le reste est en lecture seule. Source : `agents/ownership.yaml`.
<!-- OWNERSHIP:end -->

## Interdit
- Modifier l'Elo autrement que par la fonction de validation d'un match.
- Vendre ou accorder un avantage de classement lié à un abonnement.
- Écrire dans les chemins d'un autre domaine ; le chat de match appartient à `realtime`.

## Lire avant de commencer
`docs/product/README.md` §5 · `docs/product/schema.sql` (§3 Football) · `docs/product/API.md` §3.2 à §3.6 · `docs/domain/football.md`.

## Règles métier critiques
- **Un joueur, une équipe active** ; gel de 7 jours après avoir quitté une équipe ; un seul capitaine.
- Équipe « active » à partir de 7 joueurs (paramètre de configuration, le format reste à confirmer).
- **Elo** : départ 1000 ; `E = 1 / (1 + 10^((Rb − Ra)/400))` ; K = 48 pour les 5 premiers matchs, 32 ensuite ; victoire 1, nul 0,5, défaite 0 ; plancher 100. Équipes **non classées** pendant leurs 3 premiers matchs.
- Les **deux capitaines déclarent séparément** score et événements ; concordance exacte → match validé et Elo appliqué ; divergence → litige tranché par un admin ; une seule déclaration au bout de 24 h → acceptée provisoirement avec contestation possible 48 h.
- **Forfait** : défaite 0-3 et pénalité de fiabilité.
- **MVP** voté **uniquement par les joueurs de l'équipe adverse**.
- Aucun double créneau sur un même terrain.
- L'historique de tous les matchs est conservé.

## Événements produits
`team.created`, `team.member_joined`, `team.member_left`, `match.scheduled`, `match.validated`, `match.disputed`, `match.forfeit`, `badge.awarded`.

## Écrans
Mon équipe, créer/rejoindre, défier, calendrier, saisie du score, classements équipes et joueurs, fiche joueur, historique, compétitions ; back-office : litiges, terrains.

## Commandes
`pnpm turbo run lint typecheck test --filter=@conexa/football...` · `pnpm test:integration --filter=@conexa/football`

## Reçoit de / passe la main à
Fournit `match.scheduled` à `realtime` (création du chat) · fournit la copie « équipe de l'utilisateur » à `identity` · consomme les droits d'équipe de `billing` (page d'équipe, stats avancées).

## Définition de terminé
Tests unitaires de l'Elo (valeurs de référence, plancher, K variable) · tests d'intégration des fonctions SQL sur un vrai PostgreSQL · jamais d'Elo appliqué deux fois pour un même match.
