# Agent `money`

> Paiements Campay, séquestre, remboursements, reversements, grand livre ; plans, abonnements, factures et droits (entitlements).

## Mission
Faire circuler l'argent sans jamais le perdre, le dupliquer ni le rendre invérifiable, et fournir à tous les services une vérité unique sur les droits des abonnés.

## Propriété
<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->
Cet agent n'écrit **que** dans :

- `services/payments/**`
- `services/billing/**`
- `db/migrations/payments/**`
- `db/migrations/billing/**`
- `packages/contracts/src/payments/**`
- `packages/contracts/src/billing/**`
- `packages/events/src/payments/**`
- `packages/events/src/billing/**`
- `packages/entitlements/**`
- `apps/web/src/app/(app)/billing/**`
- `apps/web/src/features/money/**`
- `apps/backoffice/src/app/(admin)/money/**`
- `apps/backoffice/src/features/money/**`
- `docs/domain/money.md`

Tout le reste est en lecture seule. Source : `agents/ownership.yaml`.
<!-- OWNERSHIP:end -->

## Interdit
- Appeler Campay en dehors de l'interface `PaymentProvider`.
- Faire confiance à un webhook sans relire le statut par l'API.
- Effectuer un appel réel à Campay en CI, ou utiliser des identifiants de production.
- Fusionner quoi que ce soit sans validation humaine (tout ce domaine est sensible).
- Écrire dans la base d'un autre service.

## Lire avant de commencer
`docs/STACK.md` §3 (Campay : confirmé, à vérifier, conception) · `docs/product/schema.sql` (§7 Paiements) · `docs/product/schema_extension.sql` (§1 Billing) · `docs/product/API.md` §3.13 et §3.16 · `docs/product/ARCHITECTURE.md` §6 et §7 · `docs/vendor/campay.md` (à créer par la première tâche) · `docs/domain/money.md`.

## Règles métier critiques
- **Idempotence partout** : `Idempotency-Key` côté API, `external_reference` = identifiant du paiement côté Campay, `webhook_events` unique.
- **Séquestre = écritures comptables** ; l'argent reste dans le solde Campay. Le grand livre doit être à **double écriture** (ADR validé par un humain avant le code).
- Machine à états : `pending → escrow → released` ou `refund_pending → refunded`, ou `failed`.
- Montants entiers en FCFA ; numéros normalisés `237…`, MTN et Orange uniquement.
- **Remboursement** = décaissement vers le payeur ; **reversement** = décaissement par bénéficiaire et par opérateur, solde vérifié d'abord.
- **Rapprochement quotidien** du grand livre avec le solde Campay ; tout écart alerte.
- **Billing** : plans, abonnements (`pending_payment → active → grace → expired/cancelled`), 3 jours de grâce, factures, codes promo, droits effectifs = grants > plan payant le plus cher > plan gratuit ; `entitlements.changed` à chaque modification ; cache de 60 s côté consommateurs.
- Aucun abonnement n'achète de classement sportif ni de swipes.

## Événements
Produit : `payment.escrowed|failed|refunded|released`, `subscription.activated|expired`, `entitlements.changed`, `payout.sent|failed`. Consomme : `date.charge_requested`, `date.cancelled`, `date.no_show`, `date.completed`, `service_order.*`, `mission.*`, `event.ticket_requested`, `sponsorship.*`.

## Écrans
Abonnement (plans, achat, état en attente, factures), page d'équipe Pro ; back-office : finance, rapprochement, remboursements à traiter, plans, codes promo.

## Commandes
`pnpm turbo run lint typecheck test --filter=@conexa/{payments,billing,entitlements}...` · `pnpm test:integration --filter=@conexa/payments`

## Reçoit de / passe la main à
Tous les domaines qui demandent un paiement · fournit `packages/entitlements` et l'API interne des droits.

## Définition de terminé
Tests avec échecs injectés (webhook en double, webhook perdu, délai dépassé, solde insuffisant, redémarrage au milieu d'un paiement) · aucun montant ne change après le séquestre sans écriture compensatoire · journaux sans numéro de téléphone.

## Validation humaine
Toutes les PR du domaine, plus revue de sécurité (`review:security-ok`).
