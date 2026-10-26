# Handoff → agent `dating` : publier `dating.embedding_requested` v1

De : agent `ai` (T-0010) · Pour : agent `dating` (F4.3) · Date : 2026-10-26
Statut : **demande de contrat**, pas une implémentation. `ai` n'écrit pas dans
`services/dating/**` ni dans `packages/events/src/dating/**`.

## 1. Objet

Le consommateur `ai` est prêt : il accepte `dating.embedding_requested`, calcule
trois vecteurs de 64 dimensions et publie `embedding.computed`. Le contrat
consommateur v1 est gelé et testé :
[`dating.embedding_requested.v1.md`](dating.embedding_requested.v1.md) et
[`tests/fixtures/consumer/`](../tests/fixtures/consumer/cases.json).

Il manque le côté producteur, qui appartient à `dating` :

1. publier le **schéma canonique** de l'événement ;
2. **émettre** l'événement après l'enregistrement d'un profil de rencontre ;
3. documenter et tester ce producteur, y compris ses cas de refus.

Tant que ce n'est pas fait, F4.3 n'est pas intégrée de bout en bout : le worker
est testé avec des fixtures, pas avec un vrai producteur.

## 2. Livrables attendus (chemins de `dating`)

| Livrable | Chemin attendu | Notes |
|---|---|---|
| Schéma producteur v1 | `packages/events/src/dating/dating.embedding_requested.v1.*` | Convention §9 de `agents/GIT_WORKFLOW.md` : `.ts` si le générateur F0.4 est disponible, sinon JSON comme `packages/events/src/ai/`, avec accord `architect`. |
| Émission après sauvegarde | `services/dating/**` | Après commit de la transaction, jamais avant. |
| Documentation domaine | `docs/domain/dating.md` | Absent aujourd'hui : y décrire le catalogue, les identifiants, la version de questionnaire et l'émission. |
| Tests producteur | `services/dating/**` | Schéma, émission, transaction annulée, rejeu. |
| Étiquette de revue | PR | `review:architect-ok` (contrat/événement) et `review:security-ok` si le chemin est sensible. |

Aucune modification de `services/ai-worker/**` n'est nécessaire : le worker
consomme déjà v1. Si le contrat doit changer, voir §7.

## 3. Ce que le producteur doit produire

Exemple complet accepté :
[`valid/full.json`](../tests/fixtures/consumer/valid/full.json).
Résumé exécutoire :

```json
{
  "id": "uuid",
  "type": "dating.embedding_requested",
  "version": 1,
  "occurred_at": "2026-10-26T09:00:00Z",
  "producer": "dating",
  "traceparent": "00-…-…-01",
  "payload": {
    "user_id": "uuid",
    "profile_id": "uuid",
    "questionnaire_version": 1,
    "answers": {
      "values": {"q_family": "important"},
      "personality": {"q_outgoing": 4, "q_humor": ["dry", "absurd"]},
      "lifestyle": {"q_night": "rare"}
    }
  }
}
```

Règles non négociables (détail et matrice de rejet dans le contrat) :

- `version` exactement `1`, `producer` exactement `dating`, `type` exact,
  `occurred_at` ISO-8601 **avec fuseau** (`Z` ou offset) ;
- `id` non vide, unique par émission, réutilisé tel quel en cas de retry ;
- `user_id` et `profile_id` opaques, jamais un e-mail ou un nom ;
- `answers` contient **les trois blocs** `values`, `personality`, `lifestyle`,
  même vides ; 40 réponses maximum par bloc ;
- clés de question et options : minuscules `[a-z0-9][a-z0-9_-]*`, 64 caractères
  maximum, **jamais de libellé ni de texte libre** ;
- réponses : option unique, entier 1–5, ou tableau non vide d'options
  **distinctes** ; booléens, flottants et objets refusés ;
- champs supplémentaires d'enveloppe/payload ignorés par `ai` ; bloc inconnu
  refusé.

## 4. Points de mapping à traiter côté `dating`

- `docs/product/API.md` §3.7 utilise `questionnaire_v` dans `PUT /dating/profile`.
  L'événement attend `questionnaire_version`. Le mapping doit être explicite et
  testé ; `ai` n'accepte pas `questionnaire_v`.
- Si la base stocke des identifiants numériques ou des UUID pour les questions et
  options, il faut une table de correspondance vers des **slugs stables**. Un
  changement de slug change les vecteurs : il exige un nouveau `model_version`
  et un recalcul (ADR 0003), pas une simple migration silencieuse.
- `seeking`, `age_min`, `age_max` ne font pas partie de v1 : ils ne sont pas
  encodés dans les trois vecteurs actuels. Les ajouter est une évolution de
  contrat (§7), pas un champ libre.
- Le profil incomplet : le contrat accepte des blocs vides, mais un profil sans
  aucune réponse ne produit aucun signal. Décider quand `dating` émet (voir §6).
- `ai` ne stocke rien : la persistance pgvector de `embedding.computed` et
  `dating.vectors_updated` reste chez `dating`, dans une tâche distincte.

## 5. Sémantique de publication attendue

- **Après commit uniquement** : publier après la transaction qui enregistre le
  profil. Un rollback ne doit produire aucun événement.
- **Outbox transactionnelle recommandée** : écrire l'événement dans une outbox
  dans la même transaction, puis le relayer. Une publication directe après
  commit peut perdre l'événement si le processus meurt entre les deux.
- **Au moins une fois** : les retries sont normaux. Réutiliser le **même** `id`
  d'événement pour un retry ; `ai` mémorise le résultat par `type:id` et renvoie
  exactement la même sortie. Une nouvelle soumission légitime reçoit un nouvel
  `id`.
- **Pas de boucle sur rejet** : un événement refusé par `ai` est un bug
  producteur, pas une panne transitoire. Le bus doit le rejeter/consigner, pas
  le rejouer indéfiniment. `ai` journalise `type`, `id` et le motif, jamais les
  réponses.
- **Ordre et concurrence** : définir ce qui fait foi si deux mises à jour du
  profil se croisent (dernière écriture, version de profil, ou sérialisation par
  profil). `ai` calcule chaque événement indépendamment ; c'est `dating` qui
  décide quel résultat conserver.
- **Trace** : propager le `traceparent` de la requête HTTP quand il existe ; il
  est recopié dans `embedding.computed`.
- **Observabilité** : compter émissions, échecs de publication et rejets
  consommateur ; ne jamais journaliser réponses, vecteurs ou identifiants de
  contact.
- **Amorçage** : si des profils existent déjà, les réémettre par lots limités en
  débit. Le calcul est déterministe, donc un rejeu ne change pas les vecteurs.

## 6. Décisions à trancher par `dating`

1. **Identifiants** : quelle source fait foi pour les slugs de questions et
   d'options, et comment garantir leur stabilité dans le temps ?
2. **Version de questionnaire** : quand incrémenter `questionnaire_version`, et
   faut-il réémettre tous les profils après un changement de catalogue ?
3. **Déclencheurs** : émettre à chaque `PUT /dating/profile`, uniquement si les
   réponses changent, ou à la validation finale du questionnaire ?
4. **Profil incomplet** : exiger au moins une réponse par bloc avant d'émettre,
   ou accepter les blocs vides comme le contrat le permet ?
5. **Choix multiple** : maximum par question côté produit (le worker tolère 40
   réponses par bloc, ce n'est pas une règle d'UX).
6. **Cycle de vie** : que se passe-t-il à la pause, à la suppression du compte ou
   au retrait du consentement (nouvel événement ? arrêt d'émission ? purge côté
   dating) ?
7. **Concurrence** : règle de résolution des mises à jour simultanées (§5).
8. **Champs futurs** : faut-il un `profile_revision` optionnel dès v1 pour
   départager les versions, ou attendre un besoin réel ?

Ces décisions appartiennent à `dating` ; `ai` peut revoir la compatibilité mais
ne les prend pas à sa place.

## 7. Compatibilité et coordination

- v1 est gelé côté consommateur. Un ajout de champ optionnel est compatible ; un
  changement de sens, de blocs, de grammaire ou de contrainte impose `version: 2`
  ou un nouveau type. `ai` refuse toute version inconnue au lieu de la
  réinterpréter.
- Un changement d'encodage (blocs, tokenisation, dimensions) change
  `model_version` et exige un ADR ainsi qu'un recalcul ; `questionnaire_version`
  peut évoluer sans changer l'encodage.
- `dating` possède le schéma canonique et le producteur ; `ai` possède le corpus
  consommateur et la matrice de rejet. Toute évolution se fait dans la même
  fenêtre de compatibilité, avec les deux côtés mis à jour.
- Procédure : ouvrir une tâche `dating` (attribuée par l'orchestrateur), brancher
  depuis `origin/main`, et traiter le contrat dans une PR séparée avec
  `review:architect-ok` (GIT_WORKFLOW §4). Signaler ici toute modification du
  contrat avant de fusionner.
- Si `dating` a besoin d'une dépendance hors de ses chemins, la déclarer dans
  `deps_request` de sa tâche ; ne pas modifier les fichiers de `ai`.

## 8. Checklist d'acceptation de la PR `dating`

- [ ] schéma canonique v1 publié, validé par la CI et étiqueté
      `review:architect-ok` ;
- [ ] un profil accepté produit exactement un événement conforme, après commit ;
- [ ] une transaction annulée ne produit aucun événement ;
- [ ] un retry réutilise le même `id` et ne crée pas de doublon logique ;
- [ ] les trois blocs sont toujours présents, même vides ; les limites et la
      grammaire du contrat sont testées ;
- [ ] un payload invalide est refusé côté producteur avant émission (texte libre,
      doublon, échelle hors 1–5, bloc inconnu) ;
- [ ] `traceparent` propagé quand disponible ;
- [ ] `docs/domain/dating.md` décrit catalogue, slugs, version de questionnaire,
      déclencheurs et cycle de vie ;
- [ ] aucun journal ne contient réponses, vecteurs, e-mail ou nom ;
- [ ] le corpus `ai` reste vert : `cd services/ai-worker && python3 -m unittest
      discover -s tests -v` (59 tests).

Preuve attendue dans la PR `dating` : extrait d'événement émis (identifiants
fictifs), sortie des tests de transaction annulée et de rejeu, et lien vers le
schéma fusionné. Un test d'intégration publiant un vrai événement vers `ai` est
souhaitable dès que le bus F0.4 existe ; en attendant, la conformité au corpus
suffit.

## 9. Références

- Contrat consommateur : [`dating.embedding_requested.v1.md`](dating.embedding_requested.v1.md)
- Corpus : [`cases.json`](../tests/fixtures/consumer/cases.json)
- ADR d'encodage : [`docs/decisions/0003-vecteurs-rencontres.md`](../../../docs/decisions/0003-vecteurs-rencontres.md)
- Domaine IA : [`docs/domain/ai.md`](../../../docs/domain/ai.md)
- API rencontres : `docs/product/API.md` §3.7
- Règles de travail : `agents/GIT_WORKFLOW.md` §4, §9 et §10

## 10. Hors périmètre de cette demande

Contenu et UI du questionnaire, éligibilité 18+/fiabilité ≥ 40, stockage
pgvector, consommation de `embedding.computed`, propositions F4.4, mesure
d'équité, encodage neuronal. Ces sujets restent dans les tâches `dating`/`ai`
correspondantes.
