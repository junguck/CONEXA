# Domaine `ai`

> Worker Python : calcule les embeddings, met à jour les vecteurs après un date, alimente les recommandations.

État : **partie rencontres démarrée** (T-0010). Le worker calcule et publie ; il ne stocke aucune donnée personnelle et n'accède à aucune base d'un autre service.

## 1. Périmètre livré

| Capacité | État | Où |
|---|---|---|
| Trois vecteurs de rencontre (valeurs, personnalité, mode de vie), 64 dimensions | fait | `services/ai-worker/conexa_ai_worker/encoder.py` |
| Mise à jour Rocchio après un date (α = 0,1, β = 0,05) | fait | `services/ai-worker/conexa_ai_worker/rocchio.py` |
| Consommation `dating.embedding_requested` / production `embedding.computed` | fait, contrat producteur dating en attente | `events.py`, ADR 0003 |
| Consommation `date.completed` / production `dating.vectors_updated` | fait (forme proposée) | `events.py` |
| Idempotence par identifiant d'événement | fait (mémoire + adaptateur Redis injecté) | `idempotency.py` |
| Boucle de consommation avec acquittement et file d'échecs | fait (transport à brancher, F0.4) | `runtime.py` |
| Embeddings Talents / Marketplace (1536 dimensions) | non commencé | F5.1, F5.5 |
| Propositions hebdomadaires et mesure d'équité | non commencé, côté dating (F4.4) | — |

## 2. Pipeline rencontres

```text
dating ──dating.embedding_requested──► ai
                                        │ encode_profile(answers)
                                        ▼
dating ◄──embedding.computed─────────── ai   (vecteurs + model_version)

dating ──date.completed──► ai
                            │ rocchio_update(bloc par bloc)
                            ▼
dating ◄──dating.vectors_updated── ai
```

### Entrée `dating.embedding_requested` (contrat consommateur v1 gelé, schéma producteur à publier)

```json
{
  "user_id": "uuid",
  "profile_id": "uuid",
  "questionnaire_version": 1,
  "answers": {
    "values": {"q_family": "important", "q_honesty": "always"},
    "personality": {"q_outgoing": 4, "q_humor": ["dry", "absurd"]},
    "lifestyle": {"q_night": "rare", "q_sport": 2}
  }
}
```

- Enveloppe : `version` exactement `1`, producteur `dating`, `occurred_at` ISO-8601 **avec fuseau**. Une version inconnue est refusée, jamais réinterprétée.
- Réponses = identifiants de choix (`[a-z0-9][a-z0-9_-]*`) ou entiers 1–5. Tout texte libre est refusé ; les choix multiples sont non vides et sans doublon.
- Les trois blocs (`values`, `personality`, `lifestyle`) sont obligatoires ; un bloc vide produit un vecteur nul de 64 dimensions.
- Aucun libellé français ne circule : le hash porte sur l'identifiant.
- Contrat complet et matrice de rejet : [`services/ai-worker/contracts/dating.embedding_requested.v1.md`](../../services/ai-worker/contracts/dating.embedding_requested.v1.md) ; corpus exécutable dans `services/ai-worker/tests/fixtures/consumer/`.

### Sortie `embedding.computed`

`{ user_id, profile_id, questionnaire_version, model_version, dimension, vectors { values, personality, lifestyle } }` — schéma : [`packages/events/src/ai/embedding.computed.v1.json`](../../packages/events/src/ai/embedding.computed.v1.json).

### Entrée `date.completed` (partie IA)

`{ date_id, updates: [ { user_id, outcome: "liked" | "passed", current: {bloc: [64]}, partner: {bloc: [64]} } ] }`. `updates` peut être vide : aucun vecteur n'est alors produit. Un seul partenaire par date : `liked` applique α, `passed` applique β.

### Sortie `dating.vectors_updated`

`{ user_id, date_id, model_version, update_model_version, update {type, alpha, beta}, vectors }` — schéma : [`packages/events/src/ai/dating.vectors_updated.v1.json`](../../packages/events/src/ai/dating.vectors_updated.v1.json).

## 3. Décisions et invariants

- Encodage, dimensions, versionnage et alternatives : [ADR 0003](../decisions/0003-vecteurs-rencontres.md).
- `model_version` accompagne chaque vecteur ; un changement d'encodage impose une nouvelle version et un recalcul.
- Rejeu : clé `type:id`, résultat mémorisé et rejoué à l'identique ; un seul calcul. Le magasin est soit en mémoire, soit Redis (`GET`/`SET EX`, JSON, TTL 7 jours) ; une entrée corrompue lève `IdempotencyError` plutôt que de republier.
- Ordre de la boucle : traiter, **publier, puis acquitter**. Un échec de publication laisse l'événement non acquitté pour redistribution ; un événement invalide est rejeté et éventuellement consigné, jamais rejoué en boucle.
- Déterminisme : SHA-256, pas de `hash()` Python, arrondi à 9 décimales, aucun appel réseau.
- Les vecteurs sont des données personnelles : jamais journalisés, jamais persistés par le worker. La persistance (pgvector) appartient à dating.
- Le texte d'un utilisateur est une donnée, jamais une instruction : le worker n'a ni outil, ni réseau, ni accès fichier au-delà de son code.

## 4. Exploitation

```bash
cd services/ai-worker
python3 -m unittest discover -s tests -v          # 59 tests
python3 -m unittest tests.test_consumer_contract -v
python3 -m conexa_ai_worker < tests/fixtures/dating.embedding_requested.v1.json
```

L'intégration à Turborepo reste à faire (tâche `platform`, F0.3) : un paquet de
workspace sans dépendance n'obtient pas d'importateur dans `pnpm-lock.yaml`, donc
`--frozen-lockfile` échoue. Les tests se lancent directement avec Python.

- Journalisation : type et identifiant d'événement, nombre d'événements produits, durée. Rien d'autre.
- Erreur de validation : l'événement est refusé (`InvalidEvent`) ; l'adaptateur de bus devra l'envoyer en file d'échecs, jamais le rejouer indéfiniment.
- Panne : le worker est sans état. Avec le magasin en mémoire, un redémarrage perd le cache et le rejeu recalcule des sorties identiques ; avec Redis, le cache survit.
- Concurrence : `GET` puis `SET` n'est pas atomique ; deux instances peuvent recalculer le même événement. Les sorties sont déterministes et les consommateurs dédupliquent sur l'identifiant, donc aucun état divergent.
- Bus : `runtime.Delivery` porte `ack`/`reject` ; l'adaptateur F0.4 doit acquitter après le retour de `run_once`, et fournir un `DeadLetterSink` pour les événements refusés.

## 5. Limites et suite

1. **Contrat producteur manquant** : le contrat consommateur v1 est gelé et testé (enveloppe, blocs, grammaire, rejets), mais `dating` doit encore publier le schéma canonique de `dating.embedding_requested` avant l'intégration de bout en bout.
2. **F0.4** : les schémas de `packages/events/src/ai/` ne sont pas encore compilés par le générateur commun.
3. **Stockage** : la migration pgvector de `dating_profiles` (schema.sql absent, ADR 0002) reste chez dating.
4. **Idempotence durable** : l'adaptateur Redis est prêt ; il reste à injecter le client réel fourni par platform (F0.2) et à choisir la politique de file d'échecs.
5. **Qualité** : mesure du taux de « oui » par segment et comparaison avec un modèle neuronal (option 2 de l'ADR) sur des données réelles.
6. **Outillage Python** : `typecheck` (pyright/mypy), image Docker et tâche Turborepo à fixer par platform (F0.3).
