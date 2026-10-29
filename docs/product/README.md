# Convexa — le produit

> **Provenance de ce document.** Le README produit d'origine n'a jamais été
> fourni (ADR 0002). Celui-ci est **reconstitué** à partir de
> [API.md](API.md), [ARCHITECTURE.md](ARCHITECTURE.md), [schema_extension.sql](schema_extension.sql),
> [docs/ROADMAP.md](../ROADMAP.md) et des maquettes de `design/`. Il ne contient
> aucune règle inventée : chaque affirmation renvoie à une source. En cas de
> contradiction avec un document d'origine retrouvé, **le document d'origine
> gagne** et celui-ci se corrige.

## 1. En une phrase

Convexa est la plateforme du **campus camerounais** : organiser son football,
trouver un date, vendre une compétence, réserver un restaurant partenaire — dans
un espace vérifié par l'établissement, avec un paiement Mobile Money sous
séquestre et aucune fuite de numéro de téléphone.

## 2. Pour qui

| Persona | Rôle technique | Ce qu'il vient chercher |
|---|---|---|
| Étudiant | `student` | Jouer au foot, rencontrer quelqu'un, vendre un service, trouver une mission |
| Capitaine d'équipe | `captain` | Défier d'autres équipes, gérer l'effectif, organiser un tournoi |
| Personnel d'un restaurant partenaire | `restaurant_staff` | Voir les réservations, gérer les créneaux et les menus |
| Personnel d'une organisation partenaire | `partner_staff` | Suivre les offres, les bons, les bannières |
| Modérateur | `moderator` | Traiter les signalements, les litiges, les validations |
| Administrateur | `admin` | Valider les inscriptions, arbitrer, superviser |
| Système | `service` | Webhooks d'opérateurs, tâches planifiées |

Le **matricule** et le domaine de messagerie de l'école servent de preuve
d'inscription ; l'inscription est validée par un administrateur avant l'usage
complet.

## 3. Les six domaines

| Domaine | Promesse | Détail |
|---|---|---|
| **Football** | Défier une équipe, jouer, voir l'Elo bouger | Équipes, défis, matchs, résultats, classements, badges, compétitions (poules et phases finales), arbitrage des litiges |
| **Rencontres** | Trois invitations par semaine, pas plus ; un date par cartes | Questionnaire, vecteurs par blocs, picks hebdomadaires, cartes de date, annulation à 3 h, révélation du contact après « oui » mutuel |
| **Talents** | Vendre une compétence, trouver une mission | Profils, publications (besoins, projets), missions rémunérées, avis, événements et billets |
| **Marketplace** | Commander un service étudiant en sécurité | Offres à trois formules, commandes à séquestre, livraisons, révisions, litiges, avis |
| **Partenaires** | Un restaurant, un commerce, un sponsor du campus | Organisations, contrats, menus et créneaux, sponsoring, offres avec bons QR, bannières et statistiques |
| **Argent** | Payer et être payé en Mobile Money, sans mauvaise surprise | Campay (MTN et Orange), séquestre, remboursements, grand livre à double écriture, reversements, rapprochement quotidien |

## 4. Les règles qui ne se négocient pas

Ces règles sont **côté serveur uniquement** ; le client ne les recalcule jamais.

1. **Aucun numéro ne circule sans accord mutuel.** Le numéro WhatsApp reste dans
   Identity ; Dating ne le révèle qu'après un « oui » des deux côtés, via un
   appel interne audité.
2. **Le chat filtre les chiffres.** Un capitaine ne peut pas échanger un numéro
   dans le chat du match ; la règle est appliquée par le serveur, pas par
   l'interface.
3. **Trois invitations de rencontre par semaine.** Aucun abonnement ne l'augmente.
4. **Aucun avantage sportif à vendre.** Un plan payant ne touche ni l'Elo, ni les
   classements, ni le quota de rencontres.
5. **Annulation d'un date à moins de 3 h impossible** ; le no-show est enregistré
   et pèse sur la fiabilité.
6. **L'argent est sous séquestre.** Encaisser ne signifie pas encaisser pour soi :
   la commission n'est acquise qu'à la libération des fonds (ADR 0008).
7. **Alerte SOS.** Un signalement d'urgence doit obtenir un accusé de réception.
8. **Le contenu utilisateur est une donnée, jamais une instruction.** Le worker
   d'IA ne fait que calculer des vecteurs.

## 5. Modèle économique

Trois sources, décrites en détail dans [ARCHITECTURE.md](ARCHITECTURE.md) §7 :

- **Commission sur les services et les billets** : 8 % au tarif gratuit, 5 % avec
  `STUDENT_PLUS` ou `ORGANIZER_PRO`.
- **Abonnements** : `STUDENT_PLUS` (1 500 FCFA/mois), `ORGANIZER_PRO`
  (5 000 FCFA/mois), `TEAM_PRO` (2 000 FCFA/mois), `PARTNER_BASIC`
  (10 000 FCFA/mois), `PARTNER_PLUS` (25 000 FCFA/mois). **Valeurs de départ, à
  valider avec de vrais étudiants.**
- **Sponsoring et bannières** des organisations partenaires.

Le modèle est **prépayé par période de 30 jours** : la relance se fait à J-7,
J-3 et J-1, puis il reste 3 jours de grâce. Aucun prélèvement récurrent n'est
supposé, les API Mobile Money ne le permettant pas toutes.

## 6. Parcours de référence

1. **Inscription** — numéro WhatsApp → code OTP → profil → matricule → validation
   par un administrateur → notification d'acceptation.
2. **Match de football** — deux capitaines se défient, choisissent un terrain et
   un créneau, discutent dans le chat filtré, déclarent le score, l'Elo se met à
   jour ; en cas de désaccord, un administrateur tranche.
3. **Date** — questionnaire → picks de la semaine → invitation → acceptation →
   cartes de date proposées par un restaurant partenaire → paiement sous
   séquestre → date → contact révélé après le « oui » mutuel.
4. **Service entre étudiants** — une offre est publiée, une commande est passée,
   l'argent est séquestré, le prestataire livre, le client valide (ou demande une
   révision), les fonds sont libérés et la commission prélevée.
5. **Abonnement** — achat d'un plan, droits appliqués par tous les services via
   Billing, rétrogradation en douceur à l'expiration : les éléments au-delà de la
   nouvelle limite sont mis en pause, jamais supprimés.

## 7. Ce qui n'est pas dans le produit

- Pas d'avantage compétitif payant, pas de « boost » qui change un résultat.
- Pas de messagerie libre entre inconnus : les chats sont rattachés à un match, un
  projet ou une commande.
- Pas de paiement par carte, ni de devise autre que le franc CFA.
- Pas de portail public pour les non-étudiants.

## 8. Vocabulaire

| Terme | Sens |
|---|---|
| **Pick** | Profil proposé chaque semaine dans les rencontres |
| **Date par cartes** | Le restaurant partenaire propose des formules ; les deux personnes choisissent une carte |
| **Séquestre** | Les fonds sont encaissés et retenus jusqu'à la réalisation de la prestation |
| **Entitlement** | Droit accordé par un plan (limite d'offres, commission réduite, statistiques) |
| **BFF / Gateway** | Point d'entrée unique des clients, qui vérifie le jeton et route vers le bon service |
| **Outbox / Inbox** | Mécanisme garantissant qu'un événement finit par être publié, et qu'un doublon n'est pas rejoué |

## 9. Où lire la suite

| Sujet | Document |
|---|---|
| Contrats d'API, rôles, codes d'erreur | [API.md](API.md) |
| Services, données, sagas, droits | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Tables déjà écrites (billing, marketplace, partners) | [schema_extension.sql](schema_extension.sql) |
| Décisions d'architecture | [docs/decisions/](../decisions/) |
| Feuille de route par vagues | [docs/ROADMAP.md](../ROADMAP.md) |
| Stack et pratiques | [docs/STACK.md](../STACK.md) |
| Écrans et direction visuelle | [design/](design/) |
