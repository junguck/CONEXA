# Audit d'intégration — producteur `dating.embedding_requested`

Date : 2026-10-26 · Auditeur : agent `ai` (T-0010) · Objet : travail `dating`
présent dans le worktree `v1-dating`, branche `v1/dating`, **non commité** au
moment de l'audit.

Référence : [`dating.embedding_requested.v1.md`](dating.embedding_requested.v1.md)
et la demande [`dating.embedding_requested.handoff.md`](dating.embedding_requested.handoff.md).

## 1. Verdict

**Implémentation compatible.** L'émetteur `dating` produit un événement accepté
par le worker `ai`. La matrice de rejet a été passée dans le schéma Zod de
`dating` : **22 des 23 comportements sont alignés**. Seul `blank-profile-id`
(identifiant composé d'espaces) est accepté par le schéma producteur alors que le
consommateur le refuse ; le builder ne peut pas produire ce cas en pratique
(l'identifiant vient du JWT), mais le schéma doit être resserré. Aucune
modification de `ai` n'est requise pour consommer ce producteur.

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
| Matrice de rejet dans le schéma `dating` | 4/4 valides acceptés, 18/19 refus correctement rejetés ; seul `blank-profile-id` passe. |

## 3. Écarts, tous compatibles

| Sujet | `dating` (producteur) | `ai` (consommateur) | Effet |
|---|---|---|---|
| Blocs vides | `hasSignal` exige au moins une réponse par bloc ; sinon aucun événement | Accepte les blocs vides (vecteur nul) | Producteur plus strict ; aucun profil sans signal n'est envoyé. |
| Choix multiple | API et schéma n'acceptent que `string \| number` | Accepte aussi les tableaux d'options | Sous-ensemble valide ; à rouvrir si le questionnaire ajoute du multi-choix. |
| `id` | UUID (`z.uuid()`) | Chaîne non vide | Plus strict. |
| Champs supplémentaires | `additionalProperties: false` | Ignorés | Plus strict. |
| `traceparent` | Optionnel, forwardé | Optionnel, recopié dans la sortie | Aligné. |
| Identifiants blancs | `z.string().min(1)` accepte `"   "` | Refuse un identifiant blanc | À resserrer côté `dating` (`.trim().min(1)`). |

## 4. Points à corriger avant de considérer F4.3 terminée

1. **Travail non commité et hors périmètre de T-0014** : la tâche `dating`
   existante (`tasks/T-0014-dating-v1.md`, branche `v1/dating`, statut `review`)
   exclut explicitement « embeddings et worker IA ». Le producteur a pourtant été
   écrit directement dans ce worktree, sans commit ni PR. Il faut une tâche
   dédiée (F4.3, côté `dating`) et une branche `agent/dating/T-xxxx-…` depuis
   `origin/main`. Bonne nouvelle : pour les chemins `dating`, la base de
   `v1/dating` est identique à `origin/main` (`git diff` vide), donc le patch
   peut être rejoué proprement sur une branche dédiée.
2. **Concurrence (prérequis F4.4, pas blocage du producteur)** : `putProfile` lit
   le profil, décide d'émettre, puis upsert. Deux `PUT` simultanés peuvent
   produire deux événements dont `occurred_at` (horodatage de requête) ne suit
   pas l'ordre de commit. Tant que `dating` ne stocke pas les vecteurs, la
   décision « dernière écriture gagnante » documentée suffit ; quand il les
   stockera, il ne pourra pas garantir que le vecteur conservé correspond aux
   réponses finales sans révision de profil. À trancher avant F4.4 (verrou par
   profil, `profile_revision`, ou ordre de commit).
3. **Preuve d'atomicité hors CI** : `embedding-outbox.integration.test.ts` est
   `skipIf` sans `DATING_TEST_DATABASE_URL`. Le code est prêt et le test a été
   exécuté manuellement, mais il n'est pas prouvé par défaut ; cela relève d'une
   tâche qa/ai avec un PostgreSQL de CI.
4. **Relais dépendant de F0.4** : seul élément de production absent.
   `relayDatingOutbox` existe mais aucun ordonnanceur ne l'appelle ; le socle
   fournit l'enveloppe et un bus en mémoire, pas encore de broker durable, de
   métrique, de plafond de tentatives ni de backoff.
5. **Aval F4.4** : `dating` ne consomme pas encore `embedding.computed` et ne
   stocke pas les vecteurs (pgvector hors v1) ; c'est documenté dans
   `docs/domain/dating.md` et ne bloque pas la livraison du producteur.
6. **Schéma à resserrer** : accepter `profile_id: "   "` est le seul écart de la
   matrice ; un `.trim().min(1)` suffit.

## 5. Recommandation

L'implémentation `dating` est complète et compatible : le schéma, l'émetteur et
l'outbox sont livrés, la matrice de rejet est alignée à 22/23 et le test manuel
de bout en bout est concluant. Pour la production, il ne manque que le relais
F0.4. Pour la fusion, le travail doit encore être commité sur une tâche F4.3
dédiée (T-0014 exclut les embeddings) et une branche depuis `origin/main`. Avant
F4.4, trancher la révision de profil pour que les vecteurs restent associés aux
bonnes réponses. Côté `ai`, aucune action n'est nécessaire : la fixture
`valid/dating-catalogue.json` protège la compatibilité contre toute régression
future.
