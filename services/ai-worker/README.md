# @conexa/ai-worker

Worker Python **sans dépendance externe** qui calcule les vecteurs de rencontre
et applique la mise à jour Rocchio après un date. Décision d'encodage :
[ADR 0006](../../docs/decisions/0006-vecteurs-rencontres.md). Vue d'ensemble :
[docs/domain/ai.md](../../docs/domain/ai.md).

## Événements

| Sens | Événement | Producteur |
|---|---|---|
| consomme | `dating.embedding_requested` | `dating` (contrat consommateur gelé ci-dessous, schéma producteur à publier) |
| produit | `embedding.computed` | `ai` |
| consomme | `date.completed` | `dating` |
| produit | `dating.vectors_updated` | `ai` |

Schémas des événements produits : [`packages/events/src/ai/`](../../packages/events/src/ai/).

Contrat **consommateur** de `dating.embedding_requested` :
[`contracts/dating.embedding_requested.v1.md`](contracts/dating.embedding_requested.v1.md).
Il fixe l'enveloppe, les trois blocs, la grammaire des réponses et la matrice de
rejet ; le corpus exécutable est dans `tests/fixtures/consumer/`. Le schéma
producteur canonique reste à publier par `dating` : la demande qui lui est
adressée est dans
[`contracts/dating.embedding_requested.handoff.md`](contracts/dating.embedding_requested.handoff.md).

## Commandes

```bash
cd services/ai-worker
python3 -m unittest discover -s tests -v
python3 -m unittest tests.test_consumer_contract -v
python3 -m conexa_ai_worker < tests/fixtures/dating.embedding_requested.v1.json
```

Le paquet n'a pas de `package.json` : à zéro dépendance, pnpm n'inscrit pas
l'importateur dans `pnpm-lock.yaml` et `pnpm install --frozen-lockfile` échoue.
L'intégration à Turborepo demande une tâche `platform` (F0.3) ; en attendant, les
tests se lancent directement avec Python.

Le worker ne lit aucune base, ne stocke aucun vecteur et ne journalise ni réponse
ni vecteur.

## Boucle d'événements

`conexa_ai_worker.runtime` sépare le transport du traitement :

- `Delivery` porte les rappels `ack` et `reject` fournis par le bus ;
- l'ordre est **publier puis acquitter** : une panne du bus laisse l'événement
  non acquitté, donc redistribué, jamais perdu en silence ;
- un événement invalide est rejeté, consigné si un `DeadLetterSink` est fourni,
  et ne boucle pas ;
- un lot vide (date sans mise à jour) est acquitté sans publication ;
- `run(max_events=...)` s'arrête sur source vide.

`InMemoryEventSource` ne sert qu'aux tests et aux essais locaux : le bus réel
arrive avec F0.4. L'adaptateur de bus doit acquitter dans `Delivery.ack` après
que `run_once` a rendu la main.

## Idempotence

Clé `type:id`, résultat rejoué à l'identique. Deux magasins derrière le protocole
`IdempotencyStore` :

- `InMemoryIdempotencyStore` : borné, TTL 7 jours, pour le développement ;
- `RedisIdempotencyStore` : JSON + `SET ... EX`, espace de clés
  `conexa:ai:idempotency:`, TTL 7 jours, sur tout client exposant `GET`/`SET`.

Une entrée corrompue lève `IdempotencyError` au lieu de recalculer et de
republier. `GET` puis `SET` n'est pas atomique : deux workers concurrents peuvent
recalculer le même événement ; les sorties sont déterministes et les
consommateurs dédupliquent sur l'identifiant.

## Limites connues

- Le producteur de `dating.embedding_requested` n'existe pas encore : le contrat
  consommateur v1 est gelé et testé, mais le schéma producteur canonique doit
  être publié par `dating`.
- Le client Redis (`redis-py` ou équivalent) et le bus réel restent à fournir par
  platform (F0.2/F0.4) ; l'adaptateur et la boucle sont prêts et testés avec des
  doublures.
- L'idempotence n'est pas atomique entre deux instances (voir ci-dessus).
- Pas encore de `typecheck` Python (mypy/pyright) ni d'image Docker : outillage
  à fixer par platform.
