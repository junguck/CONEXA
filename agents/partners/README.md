# Agent `partners`

> Organisations partenaires : restaurant (lieu des dates), commerçants, sponsors. Contrats, menu, formules, créneaux, offres et bons, sponsoring, bannières, portail.

## Mission
Faire du restaurant et des autres partenaires des acteurs de l'app avec leur propre portail, tout en protégeant la vie privée des étudiants.

## Propriété
<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->
Cet agent n'écrit **que** dans :

- `services/partners/**`
- `db/migrations/partners/**`
- `packages/contracts/src/partners/**`
- `packages/events/src/partners/**`
- `apps/web/src/app/(app)/offers/**`
- `apps/web/src/app/(app)/partners/**`
- `apps/web/src/features/partners/**`
- `apps/partner-portal/src/app/(portal)/**`
- `apps/partner-portal/src/features/**`
- `apps/backoffice/src/app/(admin)/partners/**`
- `apps/backoffice/src/features/partners/**`
- `docs/domain/partners.md`

Tout le reste est en lecture seule. Source : `agents/ownership.yaml`.
<!-- OWNERSHIP:end -->

## Interdit
- Recevoir ou stocker un numéro WhatsApp ou un matricule d'étudiant.
- Gérer l'argent directement ; reversements et paiements passent par `payments`.
- Écrire dans la base d'un autre service.

## Lire avant de commencer
`docs/product/README.md` §8 · `docs/product/schema.sql` (§5 Restaurant) · `docs/product/schema_extension.sql` (§3 Partners) · `docs/product/API.md` §3.9, §3.17, §3.19 · `docs/product/ARCHITECTURE.md` §8 · `docs/domain/partners.md`.

## Règles métier critiques
- Le **restaurant est une organisation de type `restaurant`** ; les routes `/restaurant/*` de `API.md` §3.9 restent **inchangées** pour les clients (`restaurant_id` correspond à un `venue_id`).
- Commission de 10 % **figée au moment de la réservation** (instantané du pourcentage du contrat).
- **Réservation d'un créneau** : retenue de 15 minutes (`slot.held`), libérée si le paiement échoue ou expire ; libérée aussi à l'annulation.
- Un partenaire voit seulement **prénom et photo** d'un étudiant (au moment de la consommation d'un bon ou du check-in).
- Bon : consommé **une seule fois**, expire (30 jours au plus), limite par étudiant, stock ; condition d'abonnement vérifiée via Billing par l'API.
- Contrat versionné, **un seul actif** par organisation ; offres et visuels **validés** par un admin avant diffusion.
- Sponsoring : `proposed → negotiating → accepted → paid → active → completed` ; un sponsoring 100 % en nature saute le paiement.
- Bannières servies seulement si visuel approuvé, partenaire actif et contrat actif.
- Numéro de reversement (MoMo/Orange) à ajouter au schéma de l'organisation.

## Événements
Produit : `slot.held`, `slot.rejected`, `slot.released`, `partner.approved`, `voucher.redeemed`, `sponsorship.paid`, `sponsorship.activated`. Consomme : `date.hold_requested`, `date.cancelled`, `date.completed`, `payment.*`, `entitlements.changed`.

## Écrans
Portail (tableau du jour, commandes, check-in, service, SOS, menu, formules, créneaux, finances, offres, bons, sponsoring, statistiques) ; étudiants : offres et bons ; back-office : candidatures, contrats, offres, visuels.

## Commandes
`pnpm turbo run lint typecheck test --filter=@conexa/partners...` · `pnpm test:integration --filter=@conexa/partners`

## Reçoit de / passe la main à
`dating` (réservations) · `money` (paiements, droits) · `realtime` (SOS en direct).

## Définition de terminé
Test de concurrence sur la dernière table d'un créneau · test de double consommation d'un bon · test de libération automatique d'une retenue expirée.

## Validation humaine
`services/partners/src/vouchers/**` passe par la revue de sécurité.
