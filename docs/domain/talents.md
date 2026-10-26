# Domaine Talents (v1)

Service `@conexa/talents`, schéma PostgreSQL `talents`, branche `v1/talents`.
Source produit : `docs/product/API.md` §3.10 à §3.12, `ARCHITECTURE.md` §2, §5.
Tâche : `tasks/T-0015-talents-v1.md`.

## Périmètre livré

- Compétences : catalogue, `PUT /me/skills` (remplacement complet, niveaux 1-5, preuve).
- Publications : création, recherche (type, compétence, texte, miennes), détail,
  modification, clôture, suppression douce, suggestions par compétences.
- Candidatures : postuler, lister (auteur), accepter, refuser, retirer.
- Missions : proposition, acceptation, financement (séquestre via Payments), livraison,
  approbation (libération du net), litige, annulation (remboursement).
- Avis : uniquement après mission approuvée, une fois par participant.
- Rencontres « meeter » : proposer, lister, accepter, refuser.
- Événements : création, liste, détail, inscription gratuite, billet payant, check-in.

## Règles et garanties

| Règle | Implémentation |
|---|---|
| Machine à états fermée | `proposed → accepted → funded → delivered → approved`, `disputed`, `cancelled` ; toute autre transition `INVALID_STATE` |
| Mission non financée | livraison et approbation refusées (`assertFunded`, `assertDelivered`) |
| Commission jamais en dur | lue via `EntitlementsGateway.commissionPct(prestataire)` puis figée sur la mission |
| Argent uniquement via Payments | `PaymentsGateway.createEscrow / release / refund` ; aucun montant encaissé par Talents |
| Avis après mission terminée | `assertCanReview` exige `approved` et un participant |
| Montant minimum | 500 FCFA |

Les doubles de v1 (`FakePaymentsGateway`, `FixedEntitlementsGateway`) sont injectés dans
`app.module.ts` : aucun mouvement d'argent réel, tout est remplaçable sans toucher aux
services.

## Écarts et points à valider

1. **Payments et Billing absents (T-0015)** : interfaces + doubles, aucun séquestre réel.
   Le remboursement d'un financement annulé passe par `refund`.
2. **Recherche sémantique** : `posts.embedding` existe mais n'est pas calculé (ADR 0003) ;
   la recherche est textuelle et par compétence.
3. **Suggestions** : classement par nombre de compétences communes puis niveau, faute de
   similarité vectorielle.
4. **Boost de publication** : non exposé en v1, faute de tarif dans les sources produit ;
   il appartient au flux Payments.
5. **Notifications et messagerie** : hors périmètre ; les missions tracent leurs étapes
   dans `mission_events`.
6. **Quotas d'événements/missions** : dépendent de Billing, non branchés.

## Vérification

- `pnpm --filter @conexa/talents typecheck && pnpm --filter @conexa/talents test` (8 tests).
- Migration appliquée sur PostgreSQL 18 local (11 tables, 8 compétences amorcées).
- Service démarré : `/health` 200, `/ready` `{ database: true }`, `/posts` sans jeton 401.
