# Événements produits par l'agent `partners`

| Fichier | Événement | Producteur | Consommateur principal |
|---|---|---|---|
| `slot.held.v1.json` | `slot.held` | `partners` | `dating` (saga de réservation) |
| `slot.rejected.v1.json` | `slot.rejected` | `partners` | `dating` |
| `slot.released.v1.json` | `slot.released` | `partners` | `dating` |

## Règles de production

- Écrits dans `partners_outbox` **dans la transaction** de la retenue : un rollback ne publie rien.
- `hold_ref` est l'identifiant opaque de la réservation du demandeur. Aucun nom, numéro,
  matricule ni texte libre ne figure dans ces événements.
- `slot.released` porte `reason` : `cancelled` (annulation) ou `expired` (15 minutes écoulées).
- Le relais réutilise l'`id` de la ligne d'outbox comme clé d'idempotence.
