# Audit d'intégration — producteur `dating.embedding_requested`

Date : 2026-10-26 · Auditeur : agent `ai` (T-0010) · Objet : travail `dating`
présent dans le worktree `v1-dating`, branche `v1/dating`, **non commité** au
moment de l'audit.

Référence : [`dating.embedding_requested.v1.md`](dating.embedding_requested.v1.md)
et la demande [`dating.embedding_requested.handoff.md`](dating.embedding_requested.handoff.md).

## 1. Verdict

**Compatible.** L'émetteur `dating` produit un événement accepté par le worker
`ai`, et les écarts constatés sont tous dans le sens restrictif (le producteur
est plus strict que le consommateur). Aucune modification de `ai` n'est requise
pour consommer ce producteur.

La compatibilité est figée par
[`tests/fixtures/consumer/valid/dating-catalogue.json`](../tests/fixtures/consumer/valid/dating-catalogue.json) :
un événement réellement produit par `buildEmbeddingRequestedEvent` avec le
catalogue v1, puis traité par `python3 -m conexa_ai_worker` (trois vecteurs,
`model_version = dating-qhash-v1`).

## 2. Ce qui a été vérifié

| Point | Résultat |
|---|---|
| Schéma canonique `packages/events/src/dating/dating.embedding_requested.v1.json` | Présent, types et contraintes alignés : `version: 1`, `producer: dating`, fuseau obligatoire, trois blocs requis, 40 réponses/bloc, slugs, échelles 1–5, options uniques. |
| Émetteur `services/dating/src/embedding-request.ts` | Valide avec Zod **avant** toute écriture ; mappe `questionnaire_v` → `questionnaire_version` ; copie `traceparent` ; `toISOString()` fournit un `Z`. |
| Outbox `db/migrations/dating/0002_outbox.sql` + `embedding-outbox.ts` | Écriture dans la même transaction que le profil ; relais après publication ; l'`id` de ligne est réutilisé. |
| Anti-doublon `shouldRequestEmbedding` | Comparaison canonique des réponses et de la version : une même écriture ne crée pas un second événement. |
| Tests unitaires `dating` | `vitest run src/embedding-request.test.ts` : **6/6 verts**. |
| Test de bout en bout | Événement produit par le code `dating` → worker `ai` : sortie `embedding.computed` avec trois vecteurs de 64 dimensions. |
| Corpus `ai` | La nouvelle fixture passe `tests.test_consumer_contract` (4 fixtures valides, 19 refus). |

## 3. Écarts, tous compatibles

| Sujet | `dating` (producteur) | `ai` (consommateur) | Effet |
|---|---|---|---|
| Blocs vides | `hasSignal` exige au moins une réponse par bloc ; sinon aucun événement | Accepte les blocs vides (vecteur nul) | Producteur plus strict ; aucun profil sans signal n'est envoyé. |
| Choix multiple | API et schéma n'acceptent que `string \| number` | Accepte aussi les tableaux d'options | Sous-ensemble valide ; à rouvrir si le questionnaire ajoute du multi-choix. |
| `id` | UUID (`z.uuid()`) | Chaîne non vide | Plus strict. |
| Champs supplémentaires | `additionalProperties: false` | Ignorés | Plus strict. |
| `traceparent` | Optionnel, forwardé | Optionnel, recopié dans la sortie | Aligné. |

## 4. Points à corriger avant de considérer F4.3 terminée

1. **Travail non commité et hors périmètre de T-0014** : la tâche `dating`
   existante (`tasks/T-0014-dating-v1.md`, branche `v1/dating`, statut `review`)
   exclut explicitement « embeddings et worker IA ». Le producteur a pourtant été
   écrit directement dans ce worktree, sans commit ni PR. Il faut une tâche
   dédiée (F4.3, côté `dating`) et une branche `agent/dating/T-xxxx-…` depuis
   `origin/main`. Bonne nouvelle : pour les chemins `dating`, la base de
   `v1/dating` est identique à `origin/main` (`git diff` vide), donc le patch
   peut être rejoué proprement sur une branche dédiée.
2. **Concurrence non traitée** : `putProfile` lit le profil existant, décide
   d'émettre, puis upsert dans une transaction. Deux `PUT` simultanés peuvent
   produire des événements incohérents avec l'état final (écrasement perdu,
   vecteurs calculés pour des réponses qui ne sont plus en base). Il faut un
   verrou par profil (`SELECT … FOR UPDATE`), une version de profil ou une
   sérialisation.
3. **Test d'outbox non exécuté en CI** : `embedding-outbox.integration.test.ts`
   est `skipIf` sans `DATING_TEST_DATABASE_URL`. Le rollback et le rejeu ne sont
   donc pas prouvés par défaut ; prévoir un PostgreSQL de CI.
4. **Relais non planifié** : `relayDatingOutbox` existe mais aucun ordonnanceur
   ne l'appelle. Le socle F0.4 fournit désormais l'enveloppe commune et un bus en
   mémoire (`packages/events`), mais pas encore de broker durable ; le relais
   n'a ni métrique, ni plafond de tentatives, ni backoff.
5. **Cycle de vie** : pause, suppression de compte et retrait de consentement ne
   changent pas l'émission ; la rétention des vecteurs reste à définir côté
   `dating`.
6. **Aval manquant** : `dating` ne consomme pas encore `embedding.computed` et ne
   stocke pas les vecteurs (pgvector hors v1) ; F4.3 n'est pas bouclée.

## 5. Recommandation

`dating` doit d'abord régulariser son travail : nouvelle tâche F4.3 (T-0014
exclut les embeddings), branche depuis `origin/main`, commit et PR avec
`review:architect-ok`. Puis traiter la concurrence et le test d'outbox en CI. Le
relais durable et la consommation de `embedding.computed` suivront avec
l'infrastructure de bus et F4.4. Côté `ai`, aucune action n'est nécessaire : la
fixture `valid/dating-catalogue.json` protège la compatibilité contre toute
régression future.
