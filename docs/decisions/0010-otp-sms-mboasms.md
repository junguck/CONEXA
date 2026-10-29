# ADR 0010 : OTP par SMS avec MBOASMS, sans WhatsApp

- **Statut** : accepté (décision humaine du 2026-10-29)
- **Date** : 2026-10-29
- **Décideur** : humain
- **Portée** : authentification | fournisseurs
- **Remplace** : l'hypothèse « OTP par WhatsApp » de `docs/STACK.md` §1 et §10,
  et la question n°7 de `docs/STATUS.md`.

## Contexte

F1.1 exige qu'un étudiant s'inscrive avec un code reçu sur son téléphone. Le
document de stack prévoyait WhatsApp (API Business de Meta), mais le fournisseur
n'était pas choisi et aucune clé n'existait : le mode `console` restait actif et
la sortie de la vague 1 ne pouvait pas être démontrée.

WhatsApp impose un compte Business vérifié, des gabarits de message approuvés par
Meta et un coût par conversation. Le SMS est disponible immédiatement, sans
gabarit à faire valider, et l'agrégateur retenu couvre le Cameroun.

## Options

1. **WhatsApp Business (ETECH KEY comme agrégateur)** : canal déjà familier aux
   étudiants, mais vérification de compte, gabarits à faire approuver, coût par
   conversation et délai d'approbation. Écarté pour la mise en service.
2. **SMS via MBOASMS** : opérationnel tout de suite, un seul champ à remplir,
   coût par SMS. Aucun gabarit à faire valider.
3. **SMS via un agrégateur international** : mêmes avantages, mais coût unitaire
   plus élevé vers le Cameroun et couverture des opérateurs locaux à vérifier.
4. **Rester en `console`** : aucun étudiant réel ne peut s'inscrire.

## Décision

**Option 2.** L'OTP de production part par **SMS via MBOASMS**. WhatsApp n'est
pas branché et n'est pas prévu : `OTP_PROVIDER` n'accepte que `console` et `sms`.

Détails opposables :

- **Interface inchangée.** `OtpSender` reste le seul point de contact ; aucun
  service ne connaît MBOASMS. Le jour où un second canal arrive, il s'ajoute
  comme une variante, sans toucher à `IdentityService`.
- **Configuration obligatoire.** `MBOASMS_URL` et `MBOASMS_API_KEY` sont exigés
  dès que `OTP_PROVIDER=sms` ; le service refuse de démarrer sans eux. Aucune URL
  par défaut n'est devinée.
- **Clé hors du dépôt.** `.env` en local (ignoré par git), gestionnaire de
  secrets en production. `.env.example` ne contient que des valeurs vides.
- **Aucun numéro dans les journaux.** Seul le statut HTTP d'un échec est
  journalisé ; le numéro reste masqué (`maskPhone`).
- **Le code ne sort que par SMS.** Il est haché en base (`OTP_HASH_SECRET`),
  expire en 10 minutes et tolère un nombre d'essais borné.
- **Format du corps isolé.** `buildSmsPayload` concentre le contrat MBOASMS en
  une fonction : les incertitudes listées dans `docs/vendor/mboasms.md` se
  corrigent là, en un seul endroit.

## Conséquences

- La question n°7 de `docs/STATUS.md` est tranchée ; il ne reste que la
  fourniture de l'URL d'envoi.
- `docs/STACK.md` §1 et §10 doivent dire « SMS (MBOASMS) » et non « WhatsApp ».
- Le canal SMS coûte par message : la limitation de débit de `POST /auth/otp`
  protège aussi la facture du fournisseur.
- Aucun accusé de livraison n'est suivi : un SMS perdu se traduit par une
  nouvelle demande d'OTP, pas par une reprise automatique.
- Un futur retour à WhatsApp ne demande pas de refonte : c'est une nouvelle
  variante de `OtpSender` et un nouvel ADR.

## Validation

`review:security-ok` sur la manipulation de la clé et l'absence de numéro dans
les journaux ; `human-ok` déjà donné par la décision du 2026-10-29. Reste à
confirmer, avant production, l'URL d'envoi et le format du corps auprès du
fournisseur.
