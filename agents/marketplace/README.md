# Agent `marketplace`

> Services entre étudiants : offres à formules, créneaux, commandes avec séquestre, livraison, révisions, litiges, avis.

## Mission
Permettre à un étudiant de vendre un service à un autre, en toute sécurité pour les deux, sans fraude académique.

## Propriété
<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->
Cet agent n'écrit **que** dans :

- `services/marketplace/**`
- `db/migrations/marketplace/**`
- `packages/contracts/src/marketplace/**`
- `packages/events/src/marketplace/**`
- `apps/web/src/app/(app)/services/**`
- `apps/web/src/features/marketplace/**`
- `apps/backoffice/src/app/(admin)/marketplace/**`
- `apps/backoffice/src/features/marketplace/**`
- `docs/domain/marketplace.md`

Tout le reste est en lecture seule. Source : `agents/ownership.yaml`.
<!-- OWNERSHIP:end -->

## Interdit
- Contourner la machine à états `transition_order` : toute transition passe par elle.
- Modifier la commission d'une commande existante.
- Gérer l'argent directement ; il passe par `payments`.
- Écrire dans les chemins d'un autre domaine.

## Lire avant de commencer
`docs/product/ARCHITECTURE.md` §9 · `docs/product/schema_extension.sql` (§2 Marketplace) · `docs/product/API.md` §3.15 et §3.18 · `docs/domain/marketplace.md`.

## Règles métier critiques
- Une offre : 3 formules au plus (`basic`, `standard`, `premium`) avec prix, délai, nombre de révisions ; créneaux réservables pour les prestations sur rendez-vous.
- **États** : `requested → accepted → funded → in_progress → delivered → completed`, avec `revision_requested`, `cancelled`, `disputed`, `refunded`. Validation automatique 72 h après la livraison.
- **Commission fixée à la création** de la commande selon le droit `service_commission_pct` du prestataire (8 % gratuit, 5 % Étudiant Plus) ; elle ne change plus ensuite.
- **Intégrité académique** : les offres contenant un terme interdit sont refusées (`LISTING_PROHIBITED`) ; catégories sensibles en revue manuelle ; signalement.
- Mise en ligne automatique seulement si fiabilité ≥ 60 et catégorie non sensible.
- Quota d'offres actives et boosts lus dans les droits (Billing) ; au-delà de la limite après rétrogradation, les offres sont **mises en pause**, jamais supprimées.
- Avis réservés aux commandes terminées, entre les deux parties.

## Événements
Produit : `service_order.requested|accepted|funded|in_progress|delivered|completed|cancelled|disputed`, `listing.approved`, `marketplace.embedding_requested`. Consomme : `payment.*`, `entitlements.changed`, `embedding.computed`.

## Écrans
Catalogue et recherche, fiche d'offre, commande, suivi, livraison, litige, avis, tableau de bord vendeur ; back-office : offres à valider, litiges, termes interdits.

## Commandes
`pnpm turbo run lint typecheck test --filter=@conexa/marketplace...` · `pnpm test:integration --filter=@conexa/marketplace`

## Reçoit de / passe la main à
`money` (séquestre) · `ai` (recherche sémantique) · `realtime` (chat de commande).

## Définition de terminé
Tests exhaustifs de la matrice de transitions (autorisées et interdites, par acteur) · test de la validation automatique · test de non-modification de la commission.

## Validation humaine
`services/marketplace/src/escrow/**` passe par la revue de sécurité.
