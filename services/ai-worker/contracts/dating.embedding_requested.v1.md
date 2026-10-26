# Contrat consommateur — `dating.embedding_requested` v1

Statut : **gelé côté `ai`** (T-0010). Le schéma producteur canonique reste à
publier par `dating` dans `packages/events/src/dating/`. D'ici là, ce document
décrit exactement ce que le worker accepte et refuse ; en cas de divergence avec
un futur schéma producteur, c'est `dating` qui fait autorité et ce corpus doit
être mis à jour dans la même PR.

- Producteur : `dating`
- Consommateur : `ai` (`services/ai-worker/conexa_ai_worker/events.py`)
- Type : `dating.embedding_requested`
- Version : `1` uniquement
- Corpus exécutable : [`tests/fixtures/consumer/`](../tests/fixtures/consumer/cases.json)

## 1. Enveloppe

| Champ | Type | Requis | Règle |
|---|---|---|---|
| `id` | string | oui | Identifiant opaque non vide ; UUID recommandé. Sert de clé d'idempotence avec le type. |
| `type` | string | oui | Exactement `dating.embedding_requested`. |
| `version` | integer | oui | Exactement `1`. Toute autre valeur est refusée, jamais interprétée comme v1. |
| `occurred_at` | string | oui | ISO-8601 **avec fuseau** (`Z` ou offset). Une date naïve est refusée. |
| `producer` | string | oui | Exactement `dating`. |
| `traceparent` | string | non | Contexte W3C, forwardé tel quel dans les événements produits ; jamais interprété ni journalisé. |
| `payload` | object | oui | Voir §2. |

Les champs d'enveloppe supplémentaires sont ignorés (compatibilité ascendante).

## 2. Payload

| Champ | Type | Requis | Règle |
|---|---|---|---|
| `user_id` | string | oui | Identifiant opaque non vide, jamais un e-mail ou un nom. |
| `profile_id` | string | oui | Identifiant opaque non vide. |
| `questionnaire_version` | integer ≥ 1 | oui | Version du **catalogue de questions**, recopiée dans la sortie. Ce n'est pas la version du modèle d'encodage (`model_version`). |
| `answers` | object | oui | Exactement les trois blocs de §3, chacun un objet (éventuellement vide). |

Champs de payload supplémentaires : ignorés. Un bloc inconnu dans `answers` est
en revanche refusé, car l'ensemble des blocs est fermé.

## 3. Réponses

Blocs autorisés : `values`, `personality`, `lifestyle`. Les trois doivent être
présents ; un bloc vide est accepté et produit un vecteur nul de 64 dimensions.
Un profil entièrement vide est donc techniquement accepté : `dating` doit éviter
de l'envoyer, aucun signal de rencontre n'en sortirait.

Par bloc :

- 40 réponses maximum.
- Clé de question : identifiant minuscule `[a-z0-9][a-z0-9_-]*`, 64 caractères
  maximum. Aucun libellé, aucun texte libre, aucune casse mixte.
- Trois formes de réponse :
  - **choix unique** : chaîne identifiant une option, même grammaire que les
    clés de question ;
  - **échelle** : entier de `1` à `5` (les booléens et les flottants sont
    refusés) ;
  - **choix multiple** : tableau non vide d'options distinctes, même grammaire.
    L'ordre est sans effet ; un doublon est refusé.
- Tout autre type (objet, booléen, flottant, `null`) est refusé.
- Aucune réponse n'est interprétée comme une instruction : seuls des
  identifiants sont hachés.

## 4. Sortie

Un seul événement `embedding.computed` v1 par entrée acceptée :
`{ user_id, profile_id, questionnaire_version, model_version, dimension, vectors }`,
avec `model_version = dating-qhash-v1`, `dimension = 64` et les trois blocs.
Contrat de sortie : [`packages/events/src/ai/embedding.computed.v1.json`](../../../packages/events/src/ai/embedding.computed.v1.json).

Les réponses et les vecteurs ne sont jamais journalisés ni persistés par le
worker. Les vecteurs ne sont jamais exposés au client.

## 5. Matrice de rejet

Un événement invalide lève `InvalidEvent`. La boucle d'événements le rejette
(`Delivery.reject`), le consigne éventuellement dans une file d'échecs et ne le
rejoue pas indéfiniment.

| Cas | Message (sous-chaîne stable) | Fixture |
|---|---|---|
| Champ d'enveloppe manquant | `missing envelope fields` | `invalid/missing-envelope-field.json` |
| Version d'enveloppe ≠ 1 | `unsupported event version` | `invalid/unsupported-envelope-version.json` |
| Producteur ≠ dating | `only the dating service` | `invalid/unknown-producer.json` |
| Type inconnu | `unsupported event type` | `invalid/unknown-type.json` |
| `occurred_at` non ISO-8601 | `valid ISO-8601` | `invalid/invalid-occurred-at.json` |
| `occurred_at` sans fuseau | `include a timezone` | `invalid/naive-occurred-at.json` |
| `user_id` absent ou vide | `user_id` | `invalid/missing-user-id.json` |
| `profile_id` absent ou vide | `profile_id` | `invalid/blank-profile-id.json` |
| `questionnaire_version` < 1 | `questionnaire_version` | `invalid/bad-questionnaire-version.json` |
| `answers` absent | `answers is required` | `invalid/missing-answers.json` |
| `answers` n'est pas un objet | `answers must be an object` | `invalid/answers-not-object.json` |
| Bloc manquant | `missing answer blocks` | `invalid/missing-block.json` |
| Bloc inconnu | `unknown answer blocks` | `invalid/unknown-block.json` |
| Texte libre | `never free text` | `invalid/free-text-answer.json` |
| Échelle hors 1–5 | `scale answers` | `invalid/scale-out-of-range.json` |
| Réponse booléenne | `boolean answers` | `invalid/boolean-answer.json` |
| Option répétée | `must not repeat` | `invalid/duplicate-option.json` |
| Choix multiple vide | `must not be empty` | `invalid/empty-multi-choice.json` |
| Type de réponse non supporté | `unsupported answer type` | `invalid/unsupported-answer-type.json` |

Les cas valides sont `valid/full.json`, `valid/empty-blocks.json`,
`valid/multi-choice-reordered.json` et `valid/dating-catalogue.json` ; le dernier
est un événement réellement produit par `dating` (catalogue v1), et le cas
réordonné doit produire exactement les mêmes vecteurs que `valid/full.json`.
Producteur audité : [`dating-integration-audit.md`](dating-integration-audit.md).

## 6. Compatibilité et évolution

- v1 est gelé : ajouter un champ optionnel est compatible ; le worker l'ignore.
- Tout changement cassant (sens, blocs, grammaire, contraintes) impose une
  nouvelle version d'événement (`version: 2`) ou un nouveau type, jamais une
  réinterprétation silencieuse de v1.
- Un changement d'encodage (blocs, tokenisation, dimensions) change
  `model_version` et exige un ADR ainsi qu'un recalcul ; `questionnaire_version`
  peut évoluer sans changer l'encodage.
- `dating` publie le schéma producteur canonique ; `ai` maintient le corpus
  consommateur et sa matrice de rejet. Toute évolution met à jour les deux dans
  la même fenêtre de compatibilité.
- Le producteur ne transmet que des identifiants opaques : pas d'e-mail, pas de
  nom, pas de texte libre.

## 7. Vérification

```bash
cd services/ai-worker
python3 -m unittest tests.test_consumer_contract -v
python3 -m unittest discover -s tests -v
```

## 8. Hors périmètre

Contenu et versionnage du questionnaire, éligibilité et fiabilité (dating),
persistance pgvector, propositions hebdomadaires, mesure d'équité, API interne,
modèles d'embeddings neuronaux.
