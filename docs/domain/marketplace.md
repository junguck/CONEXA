# Domaine Marketplace (v1)

Service `@conexa/marketplace`, schéma PostgreSQL `marketplace`, branche `v1/marketplace`.
Source produit : `docs/product/API.md` §3.15, `schema_extension.sql` §2, `ARCHITECTURE.md` §2.
Tâche : `tasks/T-0016-marketplace-v1.md`.

## Périmètre livré

- Catégories de service (semées) et recherche d'offres (texte, catégorie, prix, mode de
  livraison, tri récent/note).
- Offres à formules : création en brouillon, modification, formules (palier, prix, délai,
  révisions), disponibilités, soumission, pause, reprise, archivage.
- Favoris et avis publics par offre, tableau de bord vendeur.
- Commandes : création (commission figée), acceptation, paiement (séquestre via
  Payments), démarrage, livraison, révision, validation, annulation, litige, avis.
- Chronologie d'événements par commande.

## Règles et garanties

| Règle | Implémentation |
|---|---|
| Machine à états fermée | `requested → accepted → funded → in_progress → delivered → completed`, plus `cancelled` et `disputed` ; test exhaustif des 64 couples |
| Commission figée à la création | `commission_pct` et `commission_fcfa` écrits une fois ; les droits sont relus pour chaque nouvelle commande |
| Auto-commande interdite | `SELF_ORDER_FORBIDDEN` |
| Fraude académique | `assertListingAllowed` normalise (accents, casse) et refuse `LISTING_PROHIBITED` |
| Révisions plafonnées | `REVISIONS_EXHAUSTED` au-delà du quota de la formule |
| Offres en excès | mises en pause (`paused_reason = plan_limit`), jamais supprimées |
| Validation automatique | `auto_validate_at = livraison + 72 h` (le cron de validation reste à brancher) |
| Argent | uniquement via `PaymentsGateway` (double en v1), aucun mouvement en base |

## Écarts et points à valider

1. **Payments et Billing absents** : interfaces + doubles ; le séquestre, la libération
   et le remboursement sont appelés mais simulés.
2. **Recherche sémantique** : non implémentée (pas de pgvector, ADR 0003) ; la recherche
   est textuelle et par catégorie.
3. **Revue manuelle des offres sensibles** : la fiabilité ≥ 60 vit dans Identity ; la
   soumission met l'offre `active` directement en v1.
4. **Boost** : la table `listing_boosts` existe, l'endpoint n'est pas exposé (tarif absent
   des sources produit).
5. **Validation automatique** : l'horodatage est posé, mais aucun cron ne clôt encore la
   commande à l'échéance.
6. **Messagerie de commande** : hors périmètre, la chronologie `service_order_events`
   sert de journal.

## Vérification

- `pnpm --filter @conexa/marketplace typecheck && pnpm --filter @conexa/marketplace test`
  (6 tests, dont la table de transitions exhaustive).
- Migration appliquée sur PostgreSQL 18 local (10 tables, 7 catégories).
- Service démarré : `/health` 200, `/ready` `{ database: true }`, `/services` sans jeton 401.
