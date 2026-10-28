# ADR 0007 : grand livre à double écriture

- **Statut** : **proposé** — validation humaine obligatoire avant mise en service
- **Date** : 2026-10-27
- **Décideur** : agent `money` (proposition soumise à `review:architect-ok`, `review:security-ok` et `human-ok`)
- **Portée** : données | contrats | comptabilité
- **Remplace** : le grand livre d'origine, à **écriture simple** (une ligne par
  mouvement, sans contrepartie), qui ne permettait ni de prouver qu'un franc
  manquant venait d'un bug, ni de distinguer l'argent des clients de celui de
  Convexa.

## Contexte

Les paiements de Convexa ne sont pas des ventes simples : un date ou une commande
de service encaisse le client, **garde l'argent sous séquestre**, puis le libère
au prestataire en retenant une commission. Un remboursement peut annuler un
encaissement après coup. Le solde réel reste chez Campay, par opérateur (MTN,
Orange) ; nous n'avons aucun compte bancaire par opérateur.

Avec une écriture simple, on ne peut répondre à aucune de ces questions :

- combien devons-nous aux prestataires à un instant donné ?
- combien d'argent de clients est immobilisé (séquestre) et ne nous appartient pas ?
- un écart avec le solde Campay vient-il d'un encaissement non enregistré, d'un
  décaissement oublié ou d'un doublon ?

`agents/money/README.md` impose donc la double écriture, avec ADR validé par un
humain avant le code. L'invariant est déjà implémenté et testé ; ce document
couvre ce qui reste à trancher.

## Options

1. **Double écriture dans notre base** (`journal_entries` + `ledger_lines`) :
   chaque mouvement produit au moins un débit et un crédit de même montant, la
   somme des lignes d'une écriture est nulle. Aucune dépendance, vérifiable en
   SQL, réconcilie directement avec le solde par opérateur.
2. **Écriture simple + table de soldes** : plus simple à écrire, mais aucun
   contrôle interne ; un bug crée ou détruit de l'argent sans trace. C'est le
   schéma d'origine, écarté.
3. **Service comptable externe** (SaaS) : source de vérité hors de notre base,
   latence, coût, dépendance à un tiers pour un domaine sensible, et impossible à
   réconcilier en transaction avec nos changements d'état.
4. **Ne rien décider** : les paiements restent invérifiables ; F3.3 et F3.4 ne
   peuvent pas être considérées comme terminées.

## Décision

**Option 1.** Le grand livre est interne, en base `payments`, et fait partie de la
même transaction que le changement d'état du paiement : on n'écrit jamais un
`status = released` sans son écriture, ni l'inverse.

### Plan comptable

| Compte | Nature | Débit | Crédit |
|---|---|---|---|
| `CASH` | actif : argent détenu chez l'agrégateur | encaissement, remboursement annulé | remboursement, décaissement |
| `ESCROW_LIABILITY` | passif : argent des clients immobilisé | libération, remboursement | encaissement |
| `PROVIDER_PAYABLE` | passif : dû aux prestataires | décaissement | libération |
| `REVENUE_COMMISSION` | produit : commission acquise | — | libération |

Un `CASH` positif est un actif ; `ESCROW_LIABILITY` et `PROVIDER_PAYABLE` sont des
dettes. Le solde de `CASH`, **par opérateur**, doit égaler le solde lu chez Campay
pour cet opérateur : c'est le rapprochement (T-0024).

### Écritures

| Événement | Débit | Crédit | Quand |
|---|---|---|---|
| Encaissement confirmé | `CASH` montant | `ESCROW_LIABILITY` montant | statut fournisseur `SUCCESSFUL` **relu par l'API** |
| Libération au prestataire | `ESCROW_LIABILITY` montant | `PROVIDER_PAYABLE` net + `REVENUE_COMMISSION` commission | le décaissement a réussi |
| Décaissement au prestataire | `PROVIDER_PAYABLE` net | `CASH` net | même transaction que la libération |
| Remboursement au payeur | `ESCROW_LIABILITY` montant | `CASH` montant | le décaissement de remboursement a réussi |

Deux conséquences volontaires :

- **La commission n'est un produit qu'à la libération**, jamais à l'encaissement :
  tant que l'argent est sous séquestre, il ne nous appartient pas.
- **Aucune écriture avant que l'argent ait bougé.** Un paiement `pending`, un
  reversement `queued` ou un remboursement en échec ne produisent rien : l'écart
  de rapprochement reste nul, et la file « à traiter » porte le travail restant.

### Arrondis

Montants **entiers en FCFA**, jamais de flottant, jamais de décimale.
`commission = floor(montant × taux / 100)` ; `net = montant − commission`.
L'arrondi va toujours au client ou au prestataire, jamais à Convexa : la somme
`commission + net` égale exactement le montant encaissé (`assertSplit`), et
`assertBalanced` refuse toute écriture déséquilibrée avant insertion.

### Erreur et compensation

Une écriture est **immuable**. Corriger une erreur ne modifie ni ne supprime une
ligne : on écrit une **écriture compensatoire** (contre-passation) référencée par
`journal_entries.reference_type` et `memo`. `ledger_lines` n'a donc pas de
`update` ni de `delete` dans le code du service.

### Rapprochement

Chaque jour, par opérateur : `CASH` (débits − crédits) contre solde Campay.
Écart 0 → `ok`. Écart ≠ 0 → `mismatch`, événement `payment.reconciliation.mismatched`
et métrique `payments.reconciliation.variance_fcfa{operator}`. **Aucune correction
automatique** : un humain tranche, puis une écriture compensatoire est saisie.

### Idempotence

- `payments.external_reference` = identifiant chez le fournisseur, unique ;
- `webhook_events (provider, external_id)` unique : un webhook rejoué n'écrit rien ;
- une écriture est liée à `(reference_type, reference_id)` et n'est produite que
  dans la transition d'état correspondante ;
- `payouts` : un seul reversement actif par paiement.

## Conséquences

- Le grand livre devient la preuve : tout écart est expliqué par une ligne, ou
  par une opération non enregistrée.
- Toute nouvelle opération d'argent (litige, avoir, geste commercial) devra
  ajouter une écriture équilibrée ; le code refuse l'inverse.
- Les tests peuvent vérifier l'invariant sans base : `assertBalanced` et
  `imbalance` sont purs.
- Le back-office devra afficher le journal et le dernier rapprochement (F3.5).

## Ce qu'un humain doit trancher (bloquant pour la mise en service)

1. **Cadre juridique** du séquestre : détenir l'argent de tiers peut relever d'une
   réglementation de paiement au Cameroun. À valider par un juriste local avant
   toute production.
2. **Reconnaissance du produit** : commission acquise à la libération (proposé)
   ou à l'encaissement ? Le choix change le chiffre d'affaires et la déclaration
   fiscale.
3. **Traitement des frais Campay** (montant non confirmé, voir
   [docs/vendor/campay.md](../vendor/campay.md)) : déduits de la commission,
   refacturés au prestataire, ou charge séparée ? Aucune écriture de frais n'est
   produite aujourd'hui.
4. **TVA** sur la commission, si elle s'applique.
5. **Arrondi** : aller au franc inférieur pour la commission (proposé) est
   acceptable, mais un humain doit le confirmer.
6. **Seuil d'alerte** : tout écart alerte (proposé) ou seulement au-delà d'un
   seuil ? Un écart d'un franc peut être normal côté agrégateur.
7. **Conservation** : durée de conservation du journal (obligation comptable
   locale) et politique d'archivage.
8. **Solde par opérateur** : confirmer que Campay expose bien un solde distinct
   MTN / Orange (déjà noté comme confirmé, à revérifier sur l'environnement demo).

Tant que 1 et 2 ne sont pas tranchés, le domaine reste **proposé** : le code peut
tourner en développement et en CI, pas en production.
