## Tâche

- Tâche : `tasks/T-xxxx-nom.md`
- Agent : `agent/<nom>`
- Fonctionnalité : `F0.0`

## Ce que fait cette PR

<!-- Trois lignes maximum : le problème, la solution, ce qui change pour les autres agents. -->

## Critères d'acceptation

<!-- Recopier ceux de la tâche et cocher avec la preuve en regard. -->

- [ ] …

## Preuves

<!-- Sorties de commandes, tests, requêtes HTTP, captures. Pas de « ça marche en local » sans sortie. -->

```text
# commande
# sortie
```

## Contrats, migrations, événements

- Contrats touchés : aucun / chemins
- Migrations ajoutées : aucune / fichiers (les migrations fusionnées ne sont jamais modifiées)
- Événements ajoutés : aucun / `nom.v1`

## Dépendances

<!-- Ajout de dépendance : rôle, taille, maintenance, licence. Sinon « aucune ». -->

## Risques et retour arrière

<!-- Ce qui peut casser, comment revenir en arrière, drapeau de fonctionnalité. -->

## Revue

- [ ] `pnpm tools:check-ownership` vert
- [ ] `pnpm tools:check-migrations` vert
- [ ] `pnpm tools:check-contracts` vert
- [ ] `pnpm tools:check-pii` et `pnpm tools:check-secrets` verts
- [ ] `pnpm turbo run lint typecheck test build` vert
- [ ] les étiquettes de revue requises sont posées (la CI verte ne les remplace pas)

Étiquettes à poser : `agent:<nom>`, `feature:<F>`, et selon les chemins `review:architect-ok`, `review:security-ok`, `review:qa-ok`, `human-ok`.

## Hors périmètre

<!-- Idées utiles mais non implémentées ici : elles deviennent une tâche, pas un ajout à cette PR. -->
