# @conexa/ai-worker

Worker Python **sans dépendance externe** qui calcule les vecteurs de rencontre
et applique la mise à jour Rocchio après un date. Décision d'encodage :
[ADR 0003](../../docs/decisions/0003-vecteurs-rencontres.md). Vue d'ensemble :
[docs/domain/ai.md](../../docs/domain/ai.md).

## Événements

| Sens | Événement | Producteur |
|---|---|---|
| consomme | `dating.embedding_requested` | `dating` (contrat à publier, voir ADR 0003) |
| produit | `embedding.computed` | `ai` |
| consomme | `date.completed` | `dating` |
| produit | `dating.vectors_updated` | `ai` |

Schémas des événements produits : [`packages/events/src/ai/`](../../packages/events/src/ai/).

## Commandes

```bash
cd services/ai-worker
python3 -m unittest discover -s tests -v
python3 -m conexa_ai_worker < tests/fixtures/dating.embedding_requested.v1.json
```

Le paquet n'a pas de `package.json` : à zéro dépendance, pnpm n'inscrit pas
l'importateur dans `pnpm-lock.yaml` et `pnpm install --frozen-lockfile` échoue.
L'intégration à Turborepo demande une tâche `platform` (F0.3) ; en attendant, les
tests se lancent directement avec Python.

Le worker ne lit aucune base, ne stocke aucun vecteur et ne journalise ni réponse
ni vecteur. L'idempotence se fait sur `type + id` de l'événement.

## Limites connues

- Le producteur de `dating.embedding_requested` n'existe pas encore : la forme
  attendue est décrite dans l'ADR 0003 et testée avec des fixtures.
- Le magasin d'idempotence est en mémoire ; l'adaptateur Redis viendra avec
  l'infrastructure (F0.2/F0.6).
- Pas encore de `typecheck` Python (mypy/pyright) ni d'image Docker : outillage
  à fixer par platform.
