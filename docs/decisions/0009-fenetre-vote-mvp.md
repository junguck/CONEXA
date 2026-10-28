# ADR 0009 : fenêtre de vote du MVP fixée à 24 heures

- **Statut** : proposé (agent `football`), à valider par l'architecte et l'humain
- **Date** : 2026-10-27
- **Portée** : domaine football (F2.6), tâche [T-0031](../../tasks/T-0031-crons-cloture.md)
- **Remplace** : trou n°7 de `docs/ROADMAP.md` (« Fenêtre de vote du MVP non définie »)

## Contexte

`docs/product/API.md` et `agents/football/README.md` imposent que le MVP soit voté
**uniquement par les joueurs de l'équipe adverse**, mais aucune durée n'est fixée.
Le vote n'a de sens que si son résultat est figé : sans clôture, un vote tardif peut
changer un classement de joueurs déjà publié, et le compteur `mvp_count` devient
impossible à réconcilier.

Contraintes connues :

- la contestation d'un match dure déjà **48 h** après la validation ;
- les matchs sont saisis le soir même, souvent sur téléphone, et les joueurs sont
  des étudiants : une fenêtre trop courte rate la majorité des votes ;
- un match validé mais contesté est arbitré par un admin ; le vote ne doit pas être
  figé sur un résultat qui peut encore changer.

## Options

1. **Jusqu'à la clôture de la contestation (48 h)** : simple (une seule échéance),
   mais un vote exprimé avant une correction de score porte sur un match dont le
   résultat change, et le MVP peut être élu sur un match annulé.
2. **24 h après la validation** : couvre la soirée du match et le lendemain, laisse
   le temps à une contestation d'être déposée puis tranchée avant la fin du vote.
3. **72 h** : meilleure participation, mais un MVP « de la semaine » publié avec trois
   jours de retard et un classement joueurs instable plus longtemps.
4. **Vote ouvert jusqu'à ce qu'un admin clôture** : aucun automatisme, charge
   d'exploitation et résultats imprévisibles.

## Décision

Option 2 : **la fenêtre de vote du MVP est de 24 heures à compter de
`matches.finalized_at`** (validation, forfait ou arbitrage admin).

Règles associées :

- un vote déposé après `finalized_at + 24 h` est refusé (`INVALID_STATE`) ;
- le dépouillement est fait par le travail `close_mvp_votes` : à échéance, le joueur
  le plus voté est écrit dans `matches.mvp_user_id` et `team_members.mvp_count` est
  incrémenté **une seule fois** (`mvp_closed_at` non nul = déjà fait) ;
- à égalité, le joueur de l'équipe qui a reçu le plus de votes de l'équipe adverse au
  total l'emporte ; en cas d'égalité parfaite, l'identifiant le plus petit tranche
  (déterministe, rejouable) ;
- un match annulé, ou dont le résultat est modifié par arbitrage, ne remet pas à zéro
  le vote : la fenêtre reste ancrée sur `finalized_at`, seule la clôture est repoussée
  si le match redevient disputé avant l'échéance.

## Conséquences

- La fenêtre de vote (24 h) est plus courte que celle de contestation (48 h) : une
  contestation déposée après la clôture du vote n'invalide pas le MVP déjà publié,
  elle ne peut viser que le score et l'Elo. C'est acceptable : le MVP est un
  trophée d'ambiance, pas un résultat sportif.
- Les crons doivent tourner au moins toutes les 15 minutes pour ne pas dépasser
  24 h + 15 min (voir T-0031).
- `docs/domain/football.md` documente les deux fenêtres (24 h vote, 48 h contestation)
  et l'ordre de clôture.
- Un futur besoin de vote plus long demandera un nouvel ADR : la valeur est une
  constante du domaine (`MVP_VOTE_WINDOW_HOURS`), pas un paramètre par match.

## Validation

`review:architect-ok` (valeurs produit) puis `human-ok` si le produit souhaite une
autre durée. L'implémentation est couverte par les tests de bornes de la tâche T-0031
(`mvpWindowOpen`, clôture idempotente).
