# Campay : ce qui est confirmé, ce qui reste ouvert

> Fiche fournisseur du domaine argent. **Règle** : rien n'entre ici sans une
> source citée. Ce qui n'est pas confirmé est listé en §Ouvert et **bloque** la
> tâche correspondante ; l'API n'est jamais devinée à partir d'un nom de méthode.

- Dernière vérification : 2026-10-27
- Sources consultées : `docs/STACK.md` §3.1, qui cite la documentation Postman
  publique de Campay et la page du SDK Python publié sur PyPI.
- Ce que je n'ai pas pu faire : ouvrir les pages détaillées des endpoints. Cet
  environnement n'a **pas d'accès réseau** ; les URL, les chemins et les formes de
  réponse n'ont donc pas pu être vérifiés. Ils sont en §Ouvert, pas ici.

## Confirmé

| Point | Fait | Conséquence dans le code |
|---|---|---|
| Opérateurs | MTN et Orange **uniquement** ; un autre numéro renvoie `ER102` | `operator` est un enum `mtn_momo \| orange_money` ; un reversement exige un opérateur déclaré |
| Format du numéro | indicatif pays, `237xxxxxxxxx` ; sinon `ER101` | stockage `237…`, conversion `+237…` → `237…` avant l'appel |
| Montants | entiers, sans décimale (sinon `ER201`), devise XAF | `MoneySchema` = entier positif ; commission arrondie à l'inférieur |
| Authentification | jeton permanent (« APP KEYS ») ou jeton temporaire renouvelable | jeton lu depuis un secret, jamais journalisé |
| Environnements | `demo` (`DEV`) et `production` (`PROD`) | `CAMPAY_BASE_URL` obligatoire, aucune URL par défaut |
| Collecte | **asynchrone** : rend une `reference`, un code USSD, l'opérateur, statut `PENDING` ; statut ensuite `PENDING`, `SUCCESSFUL` ou `FAILED` | l'encaissement n'est jamais supposé : il faut relire le statut |
| Décaissement | possible vers un numéro, à **activer** dans les réglages de l'application ; `ER301` si le solde de l'opérateur est insuffisant | vérification du solde de l'opérateur avant tout décaissement ; échec → file à traiter |
| Solde | consultable **par opérateur** (MTN et Orange séparément) | rapprochement par opérateur, pas de solde global |
| Référence externe | champ `external_reference` accepté à la collecte et au décaissement | `external_reference` = identifiant interne (clé d'idempotence) |
| Lien de paiement | existe, avec redirections de succès et d'échec | `payment_url` renvoyé au client quand le fournisseur en fournit un |

Codes d'erreur confirmés : `ER101` (format du numéro), `ER102` (opérateur non
supporté), `ER201` (montant non entier), `ER301` (solde insuffisant).

## Ouvert — bloquant

Ces points bloquent la tâche [T-0021](../../tasks/T-0021-adaptateur-campay.md).
Tant qu'ils sont ouverts, `CampayPaymentProvider` **échoue fermé** : aucune
requête n'est envoyée, aucune URL n'est supposée.

1. **URL et chemins exacts** des API demo et production, y compris l'échange de
   jeton. Bloque : `collect`, `getStatus`, `disburse`, `getBalance`.
2. **Webhook** : existe-t-il ? comment est-il signé (HMAC ? en-tête ? secret
   partagé ?), est-il rejoué, quel est le format du corps ? Bloque la vérification
   de signature. La relecture du statut par l'API et le dédoublonnage
   (`webhook_events`) sont en place et testés indépendamment.
3. **Forme des réponses** : nom du champ de statut, valeurs exactes, forme du
   solde par opérateur. Bloque l'analyse des réponses.
4. Durée de vie du jeton temporaire.
5. Frais de collecte et de décaissement, plafonds, délais de disponibilité.
6. Remboursement natif : s'il n'existe pas, le remboursement est un décaissement
   vers le payeur (ADR 0007).
7. Prélèvement récurrent : supposé absent, donc période prépayée.
8. Séquestre natif : supposé absent, donc séquestre = écritures comptables.
9. Limites de débit et disponibilité du service.
10. **Cadre juridique** : détenir pour le compte de tiers l'argent d'un séquestre
    peut relever d'une réglementation de paiement. À faire valider par un juriste
    local avant toute production.

## Vérification sur l'environnement demo (à faire une fois §Ouvert levé)

1. Collecte de 100 FCFA depuis un numéro de test MTN : obtenir une `reference`
   et le statut `PENDING`, puis le statut final après validation USSD.
2. Rejouer le même `external_reference` : vérifier le comportement (doublon
   refusé ou même référence) et l'absence de double débit.
3. Décaissement du même montant vers un numéro de test : vérifier `ER301` quand
   le solde de l'opérateur est insuffisant, puis le succès après approvisionnement.
4. Lire le solde par opérateur et le comparer au compte `CASH` du grand livre
   (rapprochement, T-0024).

Preuves attendues : références, statuts et montants, **sans numéro ni clé**
(les numéros sont masqués dans les relevés).
