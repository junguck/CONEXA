# Domaine argent (payments et billing)

> État réel au 2026-10-27. Ce document décrit ce qui tourne, pas ce qui est prévu :
> le prévu est dans [docs/ROADMAP.md](../ROADMAP.md), les choix dans
> [l'ADR 0008](../decisions/0008-grand-livre-double-ecriture.md).

## Ce que fait le domaine

- **Encaisser** : collecte mobile money asynchrone, référence conservée,
  séquestre comptable à la confirmation.
- **Séquestrer** : l'argent reste chez l'agrégateur ; le grand livre sépare ce
  qui appartient aux clients, aux prestataires et à Convexa.
- **Libérer** : un décaissement par bénéficiaire et par opérateur, commission
  retenue à la libération.
- **Rembourser** : décaissement vers le payeur (pas de remboursement natif).
- **Rapprocher** chaque jour le grand livre et le solde par opérateur.
- **Vendre des droits** : plans, abonnements, droits effectifs, `entitlements.changed`.

## Invariants (testés sans base)

| Invariant | Où |
|---|---|
| Débits = crédits pour chaque écriture | `ledger.ts` (`assertBalanced`, `imbalance`) |
| `commission + net = montant`, entiers FCFA, arrondi inférieur | `ledger.ts` (`splitCommission`, `assertSplit`) |
| Transitions fermées (`pending → escrow/failed`, `escrow → released/refund_pending`, …) | `payments.rules.ts` |
| Relève 30 s pendant 15 min puis 5 min, abandon à l'échéance | `payments.schedule.ts` |
| Numéro `2376XXXXXXXX` et opérateur MTN/Orange seulement | `packages/contracts` (`MsisdnSchema`) et `payouts.rules.ts` |
| Solde de l'opérateur du bénéficiaire vérifié avant décaissement | `payouts.rules.ts` (`decidePayout`) |
| Écart de rapprochement = solde fournisseur − caisse, par opérateur | `reconciliation.rules.ts` |
| Webhook dédoublonné par `(provider, external_id)` | `webhooks.rules.ts` + table `webhook_events` |

## Flux d'un paiement

1. `POST /payments` (JWT, `Idempotency-Key`) : paiement `pending`, relève
   planifiée, `external_reference` = référence du fournisseur.
2. `POST /payments/webhooks/campay` : signature vérifiée, événement dédoublonné,
   **statut relu par l'API**, puis `pending → escrow` avec écriture
   `CASH` débit / `ESCROW_LIABILITY` crédit.
3. `POST /internal/payments/:id/release` : compte de reversement du bénéficiaire,
   solde de son opérateur, décaissement, puis `escrow → released` et deux
   écritures (`ESCROW → PAYABLE + REVENUE`, `PAYABLE → CASH`).
4. `POST /internal/payments/:id/refund` : `escrow → refund_pending →
   refunded`, écriture `ESCROW` débit / `CASH` crédit.
5. Échec de décaissement : le reversement passe en `queued` avec un motif, le
   paiement **reste sous séquestre**, `payout.failed` est publié.

## Comptes de reversement

`POST /payout-accounts` enregistre le numéro mobile money **dédié** du
bénéficiaire (distinct du WhatsApp) et son opérateur. La réponse est masquée
(`23765••••01`), le numéro n'est jamais journalisé. Un seul compte par
bénéficiaire, remplaçable.

## Tâches de fond

| Tâche | Cadence | Comportement |
|---|---|---|
| Relève des `pending` | 30 s puis 5 min par paiement | statut relu par l'API, abandon propre |
| Reprise des reversements `queued` | 5 min entre deux essais, 5 tentatives | motif conservé, alerte lisible |
| Rapprochement | quotidien (premier passage au démarrage) | ligne par opérateur, alerte si écart |

`PAYMENTS_JOBS_ENABLED=false` les désactive (tests et tâches ponctuelles).

## Événements publiés

`payment.escrowed`, `payment.failed`, `payment.released`, `payment.refunded`,
`payout.sent`, `payout.failed`, `payment.reconciliation.mismatched` ;
côté billing `entitlements.changed`, `subscription.activated`,
`subscription.expired`. Aucun numéro, aucun nom dans une charge utile.

## Bloqué, à ne pas contourner

- **Campay réel** : endpoints, corps, statuts, solde par opérateur et signature
  JWT HS256 du webhook sont confirmés par la collection Postman officielle et le
  SDK 1.1.0 ([docs/vendor/campay.md](../vendor/campay.md)). L'adaptateur est
  implémenté et testé sans réseau ; il reste à faire la **vérification demo avec
  les clés** (aucune clé n'est fournie à l'agent) et à relever la durée de vie du
  jeton, les frais et les plafonds.
- **Validation humaine de l'ADR 0008** (cadre juridique du séquestre,
  reconnaissance du produit) : sans elle, pas de production.
- **Consommateurs des droits** : Marketplace et Talents lisent encore
  `FixedEntitlementsGateway` (chemins d'un autre agent) ; la lecture réelle de
  `/internal/entitlements` est livrée côté Billing.
- **Factures, codes promo, grâce, expiration** :
  [T-0026](../../tasks/T-0026-factures-codes-promo-grace-expiration.md), non démarrée.

## Preuves sur l'environnement demo

| Date | Contrôle | Résultat |
|---|---|---|
| 2026-10-27 | `GET /api/balance/` avec le jeton permanent de l'application demo | `200`, `mtn_balance: 0`, `orange_balance: 0`, `total_balance: 0` |
| 2026-10-27 | `POST /api/collect/` 15 FCFA MTN | `200`, référence rendue, statut initial `PENDING` |
| 2026-10-27 | Rejeu du même `external_reference` | **même référence** : idempotence officielle confirmée |
| 2026-10-27 | Statut final de la collecte | `FAILED`, `reason: NOT_ALLOWED`, `app_amount: 14.00` pour `15.00` demandés |
| 2026-10-27 | `POST /api/collect/` 20 FCFA vers le numéro de test Campay | `200`, `PENDING` puis **`SUCCESSFUL`** en ~25 s |
| 2026-10-27 | Rejeu de cette collecte | **même référence** rendue une seconde fois |
| 2026-10-27 | Détail de la transaction réussie | `SUCCESSFUL` mais `amount: "0.00"`, `app_amount: "0.00"`, solde inchangé (numéro de **simulation**) |
| 2026-10-27 | JWT de signature renvoyé par Campay, vérifié avec la clé de webhook | **acceptée** ; refusée avec une clé fausse |

Le jeton permanent est accepté, la collecte est bien enregistrée chez Campay et
le rejeu est idempotent. Le refus `NOT_ALLOWED` vient du fournisseur (aucun débit)
et reste à débloquer côté application demo. Les frais semblent être
`amount − app_amount` : à confirmer avant toute écriture comptable.

**Risque identifié** : le numéro de test de la demo rend `SUCCESSFUL` avec
`amount: 0.00` sans mouvement de solde. Compter un encaissement sur le seul
statut serait faux : le montant renvoyé par l'API doit être vérifié, sinon le
grand livre et le solde fournisseur divergent au premier test.

## Vérifier

```
pnpm turbo run lint typecheck test --filter=@conexa/payments --filter=@conexa/billing --filter=@conexa/entitlements
pnpm test:integration --filter=@conexa/payments
pnpm db:migrate payments
```
