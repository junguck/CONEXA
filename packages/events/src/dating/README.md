# Événements produits par l'agent `dating`

| Fichier | Événement | Producteur | Consommateur principal |
|---|---|---|---|
| `dating.embedding_requested.v1.json` | `dating.embedding_requested` | `dating` | `ai` |

Schéma canonique JSON Schema (draft 2020-12), aligné sur le contrat consommateur
gelé par l'agent `ai` (`services/ai-worker/contracts/dating.embedding_requested.v1.md`).

## Règles de production

- L'événement est écrit dans `dating.dating_outbox` **dans la transaction** qui
  enregistre le profil : un rollback ne produit donc rien.
- Il n'est émis que si les réponses ou `questionnaire_v` changent réellement.
- `answers` contient toujours les trois blocs `values`, `personality`,
  `lifestyle`, avec les clés de question et les valeurs d'option stables du
  catalogue (`QUESTIONNAIRE_BLOCKS`).
- `profile_id` vaut l'identifiant du profil dating. En v1, la clé primaire de
  `dating_profiles` est `user_id` : les deux champs portent donc la même valeur
  opaque. Une colonne dédiée pourra les séparer sans changer le contrat.
- Le relais vers le bus (F0.4) réutilise l'`id` de la ligne d'outbox : un rejeu
  ne crée pas un nouvel événement logique.
- Aucun libellé, aucune réponse libre ni identifiant de contact ne doit entrer
  dans l'événement ou dans les journaux.
