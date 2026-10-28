# Domaine Football (v1)

Service `@conexa/football`, schéma PostgreSQL `football`, branches `v1/football` puis
`agent/football/T-0030-litiges-competitions`.
Source produit : `docs/product/API.md` §3.2 à §3.5, `ARCHITECTURE.md` §2.
Tâches : [T-0013](../../tasks/T-0013-football-v1.md),
[T-0030](../../tasks/T-0030-arbitrage-litiges.md) à
[T-0034](../../tasks/T-0034-publication-outbox.md).

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
- Litiges : file admin, arbitrage `validated` / `void`, journal `match_adjudications`,
  correction Elo et statistiques d'un match déjà validé.
- Clôtures automatiques : déclaration unique à H+24, contestation expirée à H+48,
  dépouillement du vote MVP à H+24 (ADR [0008](../decisions/0008-fenetre-vote-mvp.md)).
- Compétitions : formats `league`, `groups`, `knockout` ; inscription d'équipes,
  poules, tableau à élimination directe, classement de compétition.
- Classements équipes et joueurs, statistiques, historique Elo, badges, historique joueur.

Hors périmètre : chat des capitaines (Realtime), génération automatique du calendrier
des poules, calcul du badge « mur » (clean sheets), période « mois » des classements
(les classements sont ceux de la saison, l'Elo étant cumulatif), écrans.

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
`MatchResultService` est le **seul** écrivain de l'Elo, des statistiques et des
événements de match (`finalize`), et sait retirer ce qu'il a appliqué (`reverse`).

## Rapprochement des déclarations

Les deux capitaines déclarent `{score_a, score_b, events}`. Le serveur compare le score
et l'ensemble des faits (triés) : identiques → `validated`, sinon → `disputed`.
Une seconde déclaration de la même équipe est refusée (`REPORT_ALREADY_SUBMITTED`).
La validation n'écrit l'Elo, les statistiques et les badges qu'une fois par match
(transaction + verrou `for update` sur le match) et écrit l'événement dans l'outbox
dans la même transaction.

## Fenêtres de temps

| Fenêtre | Durée | Effet | Référence |
|---|---|---|---|
| Déclaration | 24 h après le coup d'envoi | une seule déclaration → validation provisoire ; aucune → match annulé (`no_report`) | `REPORT_DEADLINE_HOURS` |
| Contestation | 48 h après la finalisation | `POST /matches/:id/contest` accepté ; au-delà, refus puis `contest_closed_at` | `CONTEST_WINDOW_HOURS` |
| Vote MVP | 24 h après la finalisation | vote de l'équipe adverse ; au-delà, refus puis dépouillement unique | `MVP_VOTE_WINDOW_HOURS`, ADR 0008 |

Les trois valeurs vivent dans `services/football/src/rules.ts` et sont testées sur
leurs bornes exactes (`windows.test.ts`).

## Arbitrage d'un litige (F2.8)

Routes réservées au rôle `admin` (`@Roles('admin')`, jeton vérifié) :

| Route | Rôle |
|---|---|
| `GET /admin/matches/disputed` | file des litiges avec déclarations et contestations |
| `GET /admin/matches/:id/dispute` | détail d'un litige |
| `POST /admin/matches/:id/resolve` | décision `validated` (score imposé) ou `void` (sans résultat) |

Effets :

1. le match doit être `disputed` ; la transition est protégée en SQL
   (`update … where status = 'disputed'`), un second arbitrage est refusé ;
2. si le match avait déjà été finalisé (contestation après validation), `reverse`
   retire le delta Elo du match au classement courant, décrémente `matches_played`,
   retire les buts/passes et le compteur MVP, puis l'Elo est recalculé sur le score
   arbitré — les matchs validés depuis ne sont pas écrasés ;
3. `validated` réapplique Elo, statistiques et écrit `match.validated` dans l'outbox ;
   `void` laisse le match `cancelled` sans Elo ni événement de validation ;
4. chaque décision écrit `match_adjudications` (admin, décision, score, motif,
   preuves, horodatage) : c'est le journal d'audit du litige.

Le score est imposé par l'admin, les faits (`events`) sont optionnels. Un match nul
n'est pas départagé automatiquement : l'admin choisit le score.

## Travaux de clôture (T-0031)

Un seul service (`FootballJobsService`) porte les trois clôtures et le relais d'outbox.
Chaque travail est borné (50 lignes), relit l'état sous verrou et n'écrit que sur une
transition non encore faite : deux exécutions donnent le même état final.

| Travail | Déclencheur | Effet |
|---|---|---|
| `finalize_stale_reports` | H+24 après `starts_at` | une déclaration → validation provisoire (`provisional=true`) ; aucune → `cancelled` / `no_report` |
| `close_contest_windows` | H+48 après `finalized_at` | `contest_closed_at` renseigné une seule fois |
| `close_mvp_votes` | H+24 après `finalized_at` | `mvp_user_id` figé, `mvp_count` incrémenté une seule fois, égalité départagée par identifiant |
| `relay_outbox` | chaque tour | publie les événements en attente |

Exécution : planificateur interne (`setTimeout` chaîné, `FOOTBALL_CRON_ENABLED`,
`FOOTBALL_CRON_INTERVAL_MS`, défaut 5 min) ou `POST /internal/jobs/:name`
(rôle `service`). L'horloge est injectée via `FOOTBALL_CLOCK` : aucun `new Date()`
dans les règles, les tests fixent l'instant.

## Compétitions (F2.9)

| Route | Accès | Rôle |
|---|---|---|
| `GET /competitions` | authentifié | liste filtrable (`all`, `active`, `draft`, `finished`) |
| `GET /competitions/:id` | authentifié | détail |
| `GET /competitions/:id/teams` | authentifié | équipes inscrites et poule |
| `GET /competitions/:id/standings` | authentifié | classement (`group_no` optionnel) |
| `GET /competitions/:id/bracket` | authentifié | places de phase finale |
| `POST /admin/competitions` | admin | création (`draft`) |
| `POST /admin/competitions/:id/teams` | admin | inscription d'une équipe active |
| `POST /admin/competitions/:id/groups` | admin | tirage en poules (répartition en serpentin) |
| `POST /admin/competitions/:id/bracket` | admin | tableau de 4, 8 ou 16 places |
| `POST /admin/competitions/:id/slots/:slotId/match` | admin | rattache un match existant à une place |
| `POST /admin/competitions/:id/advance` | admin | inscrit le vainqueur et remplit la place suivante |

Règles :

- seules des équipes **actives** sont inscrites, une seule fois ;
- le classement de compétition compte 3/1/0 sur les matchs `validated` et `forfeited`
  rattachés à la compétition, puis différence de buts, buts marqués, identifiant ;
  un match amical ne le modifie pas ;
- les poules sont équilibrées (écart d'une équipe au plus) et déterministes ;
- un tableau de `size` places exige exactement `size` équipes inscrites ;
- un match ne remplit qu'une place (`competition_slots.match_id` unique) et une place
  ne se décide qu'une fois (`winner_team_id`) ; un nul ne désigne pas de vainqueur ;
- la finale terminée passe la compétition `finished`.

## Événements publiés

`team.created`, `team.dissolved`, `match.scheduled`, `match.validated`, `match.disputed`
(enveloppe `@conexa/events`). Depuis T-0034, **aucun service métier n'appelle le bus
directement** : l'événement est écrit dans `football.event_outbox` dans la transaction
du résultat, puis relayé par `OutboxService.relay()`. Un échec du bus laisse
`published_at` nul et incrémente `attempts` ; l'identifiant de l'événement est celui de
la ligne d'outbox, ce qui rend les reprises déduplicables par les consommateurs.

## Écarts et points à valider

1. **Schéma reconstitué** : aucune source de schéma `football` n'existait (ADR 0003).
   La migration `202610271600_0002_arbitration_competitions.sql` est additive ; `0001`
   n'est jamais modifiée.
2. **Correction Elo** : la réversion applique `- (elo_after - elo_before)` au classement
   courant, ce qui préserve les matchs validés depuis mais reste une approximation si
   plusieurs corrections se croisent. Accepté pour la v1, à revoir si les litiges se
   multiplient.
3. **MVP** : le vote est figé 24 h après la validation (ADR 0008), y compris quand une
   contestation reste ouverte : un litige tranché après la clôture ne rouvre pas le vote.
4. **Classement « mois »** : accepté par l'API mais non différencié (Elo cumulatif).
5. **Pas de FK inter-schémas** : `user_id`, `filiere_id` référencent Identity sans
   contrainte, conformément à la séparation des schémas.
6. **Planificateur** : `setTimeout` interne, pas de file distribuée. Un déploiement à
   plusieurs réplicas exécuterait les travaux en parallèle : les gardes SQL rendent
   l'effet unique, mais le passage à un ordonnanceur unique (ou un verrou consultatif)
   est à prévoir avant la production.

## Vérification

- `pnpm --filter @conexa/football typecheck && pnpm --filter @conexa/football test`
  (`windows.test.ts`, `dispute.test.ts`, `competitions.test.ts`, `elo.test.ts`,
  `report.test.ts`).
- `DATABASE_URL=… node tools/db-migrate.mjs football` applique `0001` puis `0002`.
- Démarrage du service : `/health` et `/ready` répondent, une route protégée sans jeton
  répond `401 UNAUTHENTICATED`, les routes admin sans rôle `admin` répondent `403`.
