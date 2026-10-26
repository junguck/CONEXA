# Agent `dating`

> Rencontres : questionnaire, propositions hebdomadaires, négociation par cartes, dates au restaurant, retour, révélation de contact.

## Mission
Organiser des rencontres sûres : aucun contact direct avant le date, un lieu public unique, des décisions simples et des règles d'annulation claires.

## Propriété
<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->
Cet agent n'écrit **que** dans :

- `services/dating/**`
- `db/migrations/dating/**`
- `packages/contracts/src/dating/**`
- `packages/events/src/dating/**`
- `apps/web/src/app/(app)/dating/**`
- `apps/web/src/features/dating/**`
- `apps/backoffice/src/app/(admin)/dating/**`
- `apps/backoffice/src/features/dating/**`
- `docs/domain/dating.md`

Tout le reste est en lecture seule. Source : `agents/ownership.yaml`.
<!-- OWNERSHIP:end -->

## Interdit
- Autoriser du texte libre dans la négociation d'un date.
- Révéler un numéro sans « oui » des deux personnes.
- Écrire dans la base d'un autre service (créneaux, paiements, numéros) : tout passe par événements ou API interne.
- Décider seul du payeur hors couple garçon/fille.

## Lire avant de commencer
`docs/product/README.md` §6 · `docs/product/schema.sql` (§6 Rencontres) · `docs/product/API.md` §3.7 et §3.8 · `docs/product/ARCHITECTURE.md` §6.1 (saga) · `docs/domain/dating.md`.

## Règles métier critiques
- Accès : 18 ans révolus, compte actif, questionnaire rempli, fiabilité ≥ 40, charte acceptée.
- **3 propositions par semaine** (2 « ressemblants » + 1 « complémentaire »), **3 invitations maximum** par semaine ; aucun abonnement ne les augmente.
- Un refus n'est jamais montré comme tel à l'émetteur ; quarantaine de 60 jours après un refus.
- **Cartes uniquement** (catalogue fermé de `date_cards`), jamais de texte libre.
- **Le garçon paie la totalité** ; la règle est isolée dans une fonction pure `resolvePayer()` testée ; les cas non couverts sont refusés (question produit n°2 ouverte).
- **Formule à prix plafonné** par personne ; chacun commande pour soi dans la formule.
- **Annulation libre jusqu'à 3 h avant**, impossible ensuite ; absence : pénalité de fiabilité, compensation de la personne présente.
- Numéro révélé **uniquement si les deux ont répondu « oui »** ; réponses jamais montrées avant que les deux aient répondu.
- SOS pendant le date : alerte le restaurant et l'admin immédiatement.
- Photo du partenaire révélée au **check-in**.

## Événements
Produit : `date.hold_requested`, `date.charge_requested`, `date.confirmed`, `date.cancelled`, `date.no_show`, `date.completed`, `date.sos`, `dating.embedding_requested`. Consomme : `slot.held`, `slot.rejected`, `payment.*`, `embedding.computed`, `dating.vectors_updated`.

## Écrans
Questionnaire, mes 3 propositions, invitations, négociation par cartes, choix de formule et de plat, paiement, mon date (compte à rebours, check-in, SOS), retour, contacts révélés ; back-office : dates en litige ou absences.

## Commandes
`pnpm turbo run lint typecheck test --filter=@conexa/dating...` · `pnpm test:integration --filter=@conexa/dating`

## Reçoit de / passe la main à
`partners` (tables, créneaux) · `money` (paiement) · `ai` (embeddings) · `identity` (numéro, appel interne audité) · `realtime` (notifications).

## Définition de terminé
Tests de la fenêtre de 3 h aux limites exactes (2 h 59 / 3 h 01), du quota de 3, de la quarantaine, de la confidentialité des retours · saga testée avec échecs injectés (paiement refusé, créneau perdu).

## Validation humaine
`services/dating/src/contact-reveal/**` (révélation de contact).
