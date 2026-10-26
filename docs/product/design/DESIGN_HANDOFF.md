# Convexa v2 : passation maquette vers web-core

Maquette : artifact « Convexa v2 » (canevas Design). 23 écrans mobiles, chacun en sombre et en clair, plus le portail restaurant et trois écrans de back-office.
Ce document remplace la version précédente (une seule identité pour toute l'app). La refonte rend les trois univers volontairement différents.

## 1. Architecture de navigation
Barre du bas, 5 emplacements, toujours visible sur les écrans principaux :

| Position | Libellé | Destination | Univers |
|---|---|---|---|
| 1 | Foot | `/football` (scores) | Foot |
| 2 | Meet | `/meet` (cartes) | Meet |
| 3 (centre, surélevé) | CXA | `/` (accueil) | Core |
| 4 | Pro | `/pro` (fil) | Pro |
| 5 | Moi | `/me` (profil, réglages, notifications) | Core |

- Le bouton central utilise le glyphe X sur une plaque noire. La couleur d'accent de la barre suit l'univers actif.
- Écrans sans barre : chargement, connexion, inscription, validation en cours et l'écran plein cadre « C'est un match ». Tous les autres l'affichent.
- Écran de chargement : uniquement les glyphes C, X, Λ (pas de nom, pas de texte), puis une barre de chargement.

## 2. Trois univers, trois langages
| | Foot | Meet | Pro |
|---|---|---|---|
| Usage de référence | Scores en direct (liste par ligue) | Cartes à glisser | Réseau professionnel (fil, relations) |
| Police | Barlow Condensed + Barlow Semi Condensed | Outfit + DM Sans | Inter |
| Rayon | 6 px | 14 px, cartes 24–26 px | 8 px |
| Accent | Ambre `#FFC93C`, direct en rouge `#FF4545` | Dégradé `#FF4F6D` → `#FF8A4C` | Bleu `#1469C7` |
| Thème par défaut | Sombre | Clair | Clair |
| Signature | Minute qui clignote, étoile « suivre » | Carte qui oscille, bouton « inviter » pulsé, écran de match | Fil, invitations, compétences recommandées |

Core (accueil, compte, chargement) garde l'identité Convexa : Unbounded, Instrument Sans, JetBrains Mono, bleu `#45C4FF`, rayon 3 px.
Les écrans reprennent des **usages** connus. Aucun logo, nom ou élément graphique d'une autre marque n'est copié.

## 3. Tokens
Source de vérité : `project/cxa.css` de l'artifact. Variables par univers et par thème : `--bg --surf --surf2 --line --tx --mu --ac --ac-ink --act --live --ok --bad --r --rb --fd --fu --fn --grad`.
Dans Next : une classe racine par univers (`s-foot`, `s-meet`, `s-pro`, `s-core`) et une par thème (`dk`, `lt`), mappées dans Tailwind via `theme.extend.colors` sur les variables CSS.
Contraste du texte d'accent en clair : utiliser `--act`, jamais `--ac`.

## 4. Mouvement
Entrées `rise`, `slideL/R`, `pop` ; Foot : `blinkdot` (direct) ; Meet : `swayCard`, `ringp`, confettis `fall` ; chargement : `cIn`, `xIn`, `aIn`, `glow`, `grow` ; Elo : `@property --n` (compteur).
Tout est coupé par `prefers-reduced-motion` et par le réglage Moi → « Réduire les animations ».
Geste réel pour Meet : glisser à droite = inviter, à gauche = passer ; les boutons restent obligatoires (accessibilité).

## 5. Écrans et destinations
| Écran | Route | Tâche de la ROADMAP |
|---|---|---|
| Splash, Login, Signup, Pending | `/(auth)` | F1.x identité |
| Home (CXA) | `/` | R3.1 |
| FootScores, FootMatch, FootTable, FootTeam | `/football/*` | F2.7, R3.2 |
| MeetSwipe, MeetMatch, MeetMatches, MeetPlace, MeetPay, MeetDay, MeetProfile | `/meet/*` | F4.x, R3.3 |
| ProFeed, ProNetwork, ProJobs, ProProfile, ProPremium | `/pro/*` | F5.9, R3.4 |
| Notifs, Profile | `/me/*` | F1.x, R3.5 |
| Portal, BoUsers, BoDisputes, BoFinance | `/partner`, `/admin` | F0.9, F4.x |

## 6. Règles de respect de l'utilisateur (obligatoires)
- Prix final visible avant paiement (restaurant, commande, Premium). Annulation et remboursement affichés avant de payer.
- « Plus tard » ou « Passer » toujours présent à côté d'une offre.
- Pas de compte à rebours artificiel, pas de fausse promotion, pas de limite « urgente » inventée.
- Meet : 3 propositions par semaine, aucun achat pour en avoir plus. Distance arrondie, jamais de position exacte.
- Scores live : les événements saisis par un seul capitaine sont marqués « non confirmé » ; le classement ne bouge qu'après validation des deux capitaines.
- Pro : invitations limitées par semaine, signalement sur chaque publication, pas de contact privé affiché sans accord.
- Notifications promotionnelles désactivées par défaut, 3 par jour maximum. Export et suppression des données depuis Moi.
- Zones tactiles de 44 px minimum, contraste AA, aucun état porté par la seule couleur.
- Le plan payant s'appelle **Premium** dans l'interface (le mot « Pro » désigne l'univers réseau). Les codes de plan du back-end restent inchangés.

## 7. Réserves
- Données d'exemple (noms, prix en XAF) fictives. Photos : emplacements à remplir.
- Les documents historiques (README, API, ARCHITECTURE) portent encore le nom Convexa.
- Portail restaurant et back-office gardent le système Convexa v1 (barre du haut) : ils sont desktop, hors barre du bas.
