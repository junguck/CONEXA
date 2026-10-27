# Campay : ce qui est confirmé, ce qui reste ouvert

> Fiche fournisseur du domaine argent. **Règle** : rien n'entre ici sans une
> source citée. Ce qui n'est pas confirmé est listé en §Ouvert ; l'API n'est
> jamais devinée à partir d'un nom de méthode.

- Dernière vérification : 2026-10-27
- **Sources consultées et lues** :
  - collection Postman officielle : <https://documenter.getpostman.com/view/2391374/T1LV8PVA>
    (JSON servi par `documenter.gw.postman.com`, descriptions et exemples inclus) ;
  - SDK Python officiel `campay` **1.1.0** sur PyPI
    (<https://pypi.org/project/campay/>), code source `src/campay/sdk.py` et `README.md` ;
  - `docs/STACK.md` §3.1 (codes d'erreur et contraintes).
- Hôtes : **demo** `https://demo.campay.net`, **production** `https://www.campay.net`.
  Toutes les routes sont sous `/api/`.

## Confirmé

### Authentification

| Point | Fait | Conséquence dans le code |
|---|---|---|
| Jeton | `POST /api/token/` avec `{"username","password"}` (identifiants d'**application**, section « APP KEYS ») → `{"token"}` | `CAMPAY_APP_TOKEN` / `CAMPAY_APP_SECRET` |
| En-tête | `Authorization: Token <jeton>` sur tous les autres appels | ajouté par l'adaptateur |
| Durée de vie | non documentée | cache local de 5 min, jamais journalisé |

### Collecte (encaissement)

`POST /api/collect/` — corps `{"amount":"<entier>","currency":"XAF","from":"237…","description":"…","external_reference":"…"}`.
Réponse 200 : `{"reference":"<uuid>","ussd_code":"…","operator":"mtn|orange"}`.
Statut initial `PENDING` ; l'utilisateur valide sur son téléphone.
**Idempotence officielle sur `external_reference`** : deux appels avec la même
valeur rendent le résultat du premier. Nous y envoyons notre clé d'idempotence.
Pas de lien de paiement dans cette réponse : `payment_url` reste `null`.

### Statut

`GET /api/transaction/{reference}/` → `{"reference","status","amount","currency","operator","code","operator_reference","endpoint","signature","external_reference","phone_number","app_amount","description","reason",…}`.
`status` vaut `PENDING`, `SUCCESSFUL` ou `FAILED`. Un 404 signifie « inconnu ».

### Décaissement (reversement, remboursement)

`POST /api/withdraw/` — corps `{"amount":"<entier>","currency":"XAF","to":"237…","description":"…","external_reference":"…"}`
→ 200 `{"reference","status":"PENDING"}`. **Idempotence officielle sur
`external_reference`** : nous y envoyons l'identifiant du reversement.
À activer dans les réglages de l'application (« API withdrawals »).
`ER301` = solde insuffisant sur l'opérateur concerné.

### Solde

`GET /api/balance/` → `{"total_balance","mtn_balance","orange_balance","currency":"XAF"}`.
Le solde est donc bien **par opérateur** : le rapprochement compare `CASH` MTN
à `mtn_balance`, et `CASH` Orange à `orange_balance`. Les montants arrivent avec
des décimales (`0.00`) : ils sont arrondis en FCFA entiers.

### Webhook (callback)

Déclaré dans les réglages de l'application, en **GET** (paramètres d'URL) ou
**POST** (JSON). Notifié quand une transaction passe `SUCCESSFUL` ou `FAILED`.
Champs POST : `status`, `reference`, `amount`, `currency`, `operator`, `code`,
`operator_reference`, **`signature`**, `endpoint` (`collect` ou `withdraw`),
`external_reference`, `external_user`, `phone_number`, `description`, `reason`,
`app_amount`, liens de redirection.
**Signature = JWT HS256 signé avec la clé de webhook de l'application** ;
l'en-tête JWT doit être `{"alg":"HS256"}`. Nous vérifions la signature, puis
**relisons le statut par `/api/transaction/{reference}/`** avant toute
transition : un callback ne fait jamais foi seul.

### Erreurs et contraintes

`ER101` format de numéro, `ER102` opérateur non supporté (MTN et Orange
uniquement), `ER201` montant non entier, `ER301` solde insuffisant. Montants
entiers en XAF, numéros avec indicatif pays `237…`.

## Ouvert

1. **Durée de vie du jeton** : non documentée. Choix local : cache 5 min,
   renouvellement à la première erreur d'authentification (à observer en demo).
2. **Frais** de collecte et de décaissement, et champ `app_amount` du callback
   (semble être le montant net après frais) : à relever sur des transactions
   demo réelles avant toute écriture comptable de frais.
3. **Plafonds** par transaction et par jour, limites de débit.
4. **Remboursement natif** : aucun endpoint de remboursement dans la collection
   officielle. Le remboursement est donc un **décaissement** vers le payeur
   (ADR 0007).
5. **Prélèvement récurrent** : aucun endpoint documenté → période prépayée.
6. **Séquestre natif** : aucun endpoint documenté → séquestre = écritures.
7. **Disponibilité des fonds** après une collecte (délai avant décaissement).
8. **Cadre juridique** : détenir pour le compte de tiers l'argent d'un séquestre
   peut relever d'une réglementation de paiement. À faire valider par un juriste
   local avant la production.
9. **Mass payout** (`POST /api/mass_payout/`) existe mais n'est pas utilisé :
   un reversement par bénéficiaire et par opérateur reste la règle.

## Configuration attendue

Dans `services/payments/.env` (fichier ignoré par git, jamais commité) :

```
PAYMENT_PROVIDER=campay
CAMPAY_BASE_URL=https://demo.campay.net
CAMPAY_APP_TOKEN=<identifiant d'application demo>
CAMPAY_APP_SECRET=<mot de passe d'application demo>
CAMPAY_WEBHOOK_KEY=<clé de webhook de l'application demo>
```

`CAMPAY_BASE_URL` peut aussi être fourni avec `/api` : l'adaptateur normalise.
Le callback à déclarer dans la console est
`POST https://<hôte public>/payments/webhooks/campay`.

## Vérification sur l'environnement demo (à faire avec les clés)

1. `GET /api/balance/` : relever `mtn_balance` et `orange_balance`.
2. Collecte de 100 FCFA depuis un numéro de test MTN : obtenir une `reference`,
   statut `PENDING`, puis le statut final après validation USSD.
3. Rejouer la même `external_reference` : vérifier qu'aucun second débit n'a lieu.
4. Décaissement du même montant vers un numéro de test : vérifier `ER301` quand
   le solde de l'opérateur est insuffisant, puis le succès après approvisionnement.
5. Déclarer le callback, provoquer une collecte, vérifier que la signature JWT
   est acceptée et que le statut relu correspond.
6. Comparer `CASH` par opérateur au solde lu (rapprochement, T-0024).

Preuves attendues : références, statuts et montants, **sans numéro ni clé**
(les numéros sont masqués dans les relevés).
