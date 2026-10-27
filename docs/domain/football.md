# Domaine Football (v1)

Service `@conexa/football`, schéma PostgreSQL `football`, branche `v1/football`.
Source produit : `docs/product/API.md` §3.2 à §3.5, `ARCHITECTURE.md` §2.
Tâche : `tasks/T-0013-football-v1.md`.

## Périmètre livré

- Équipes : création (l'auteur devient capitaine), recherche, détail, modification,
  dissolution, effectif, départ avec gel, transfert de capitanat, exclusion.
- Invitations (capitaine → joueur) et demandes (joueur → capitaine), expiration à 7 jours.
- Terrains et créneaux : un créneau ne porte qu'un match, garanti par une contrainte
  unique sur `field_bookings (field_id, starts_at)`.
- Défis : proposer, accepter (crée le match et réserve le terrain), refuser,
  contre-proposer, annuler.
- Matchs : feuille de match, déclaration du score et des faits par chaque capitaine,
  rapprochement automatique, contestation sous 48 h, vote MVP par l'équipe adverse,
  annulation jusqu'à H-2, forfait.
- Classements équipes et joueurs, statistiques, historique Elo, badges, historique joueur.

Hors périmètre v1 : chat des capitaines (Realtime), compétitions, calcul du badge
« mur » (clean sheets), période « mois » des classements (les classements sont ceux de
la saison, l'Elo étant cumulatif).

## Règles Elo

| Paramètre | Valeur |
|---|---|
| Elo de départ | 1000 |
| K (10 premiers matchs) | 48 |
| K ensuite | 32 |
| Plancher | 100 |
| Classé à partir de | 3 matchs validés |
| Niveaux | bronze < 1100 ≤ argent < 1300 ≤ or < 1500 ≤ platine |

Implémentation : `services/football/src/elo.ts`, testée sur des cas exacts
(`+24/-24` à la première journée, `K=32` ensuite, plancher, non-classé).

## Rapprochement des déclarations

Les deux capitaines déclarent `{score_a, score_b, events}`. Le serveur compare le score
et l'ensemble des faits (triés) : identiques → `validated`, sinon → `disputed`.
Une seconde déclaration de la même équipe est refusée (`REPORT_ALREADY_SUBMITTED`).
La validation n'écrit l'Elo, les statistiques et les badges qu'une fois par match
(transaction + verrou `for update` sur le match).

## Événements publiés

`team.created`, `team.dissolved`, `match.scheduled`, `match.validated`, `match.disputed`
(enveloppe `@conexa/events`). Le bus est en mémoire en v1 : la publication durable
(outbox RabbitMQ) arrive avec l'infrastructure.

## Écarts et points à valider

1. **Schéma reconstitué** : aucune source de schéma `football` n'existait (ADR 0003).
2. **Contestation** : la fenêtre de 48 h est appliquée ; le traitement admin du litige
   n'est pas encore exposé (aucune route admin dans ce service v1).
3. **MVP** : le leader du vote est écrit dans `matches.mvp_user_id` et incrémente son
   compteur ; la clôture du vote à 48 h viendra avec le cron.
4. **Classement « mois »** : accepté par l'API mais non différencié (Elo cumulatif).
5. **Pas de FK inter-schémas** : `user_id`, `filiere_id` référencent Identity sans
   contrainte, conformément à la séparation des schémas.

## Vérification

- `pnpm --filter @conexa/football typecheck && pnpm --filter @conexa/football test`
- `DATABASE_URL=… node tools/db-migrate.mjs football` appliqué sur PostgreSQL 18 local
  (16 tables créées).
- Démarrage du service : `/health` et `/ready` répondent, une route protégée sans jeton
  répond `401 UNAUTHENTICATED`.
