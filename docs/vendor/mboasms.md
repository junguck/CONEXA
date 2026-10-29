# MBOASMS — fournisseur d'OTP par SMS

- **Statut** : retenu pour l'OTP de production (ADR 0010), **intégration partielle**
- **Dernière vérification** : 2026-10-29
- **Propriétaire du compte** : humain (clé fournie hors dépôt)

## Ce qui est confirmé

| Élément | Valeur |
|---|---|
| Canal | SMS uniquement |
| Format de la clé | `mboa_` suivi de 32 caractères hexadécimaux |
| Transport retenu | `POST` JSON, authentification `Authorization: Bearer <clé>` |
| Émetteur | nom court affiché sur le téléphone (`MBOASMS_SENDER`, défaut `CONEXA`) |
| Usage | code OTP à 6 chiffres, durée de vie 10 minutes |

La clé **n'est jamais dans le dépôt** : elle vit dans `.env` en local
(fichier ignoré par git) et dans le gestionnaire de secrets en production.

## Ce qui reste à confirmer

Ces points ne sont pas devinés dans le code : l'URL est obligatoire en
configuration, et le corps de la requête est isolé dans une seule fonction
(`buildSmsPayload` dans `services/identity/src/otp-sender.ts`).

1. **URL d'envoi exacte** (chemin inclus) — à relever dans la console MBOASMS.
2. **Nom des champs du corps** : `sender` / `recipient` / `message` sont une
   hypothèse. Si le fournisseur attend `from` / `to` / `text`, une seule
   fonction change.
3. **Format du numéro attendu** : `2376xxxxxxxx` (indicatif, sans `+`) ou
   `+2376xxxxxxxx`. Identity stocke le numéro au format du contrat ; la
   normalisation se ferait dans `buildSmsPayload`.
4. **Réponse de succès** : code HTTP seul, ou identifiant de message à
   conserver pour le suivi ?
5. **Accusé de livraison** : webhook, rappel, ou rien. Aucun suivi de livraison
   n'est branché aujourd'hui.
6. **Codes d'erreur** (numéro invalide, crédit épuisé, expéditeur refusé) et
   politique de nouvelle tentative.
7. **Débit autorisé** et **coût par SMS**, pour calibrer la limitation de débit
   de `POST /auth/otp`.
8. **Cadre contractuel** : conditions du fournisseur, traitement des données
   (le numéro de téléphone est une donnée personnelle), durée de conservation
   des journaux côté fournisseur.

## Ce que fait le code aujourd'hui

- `OTP_PROVIDER=console` (défaut) : aucun appel réseau, le code est journalisé
  masqué. C'est le mode des tests et du développement.
- `OTP_PROVIDER=sms` : `MBOASMS_URL` et `MBOASMS_API_KEY` sont **obligatoires** ;
  le service refuse de démarrer sans eux plutôt que d'échouer à la première
  inscription.
- Le numéro n'apparaît jamais dans un journal ni dans une erreur : seul le
  statut HTTP est journalisé en cas d'échec.

## Comment vérifier sur le terrain

```bash
# 1. renseigner l'URL fournie par MBOASMS dans .env, puis
OTP_PROVIDER=sms pnpm --filter @conexa/identity start

# 2. demander un code (le numéro doit être au format attendu par le contrat)
curl -s -X POST http://localhost:3001/auth/otp \
  -H 'content-type: application/json' \
  -d '{"whatsapp":"+237655443312"}'

# 3. vérifier la réception, puis consommer le code
curl -s -X POST http://localhost:3001/auth/otp/verify \
  -H 'content-type: application/json' \
  -d '{"whatsapp":"+237655443312","code":"123456"}'
```

Un envoi refusé renvoie `INTERNAL_ERROR` avec `{ status }` ; le détail du
fournisseur n'est pas exposé au client.
