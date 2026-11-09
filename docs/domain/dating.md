# Domaine Rencontres (v1)

Service `@conexa/dating`, schéma PostgreSQL `dating`, branche `v1/dating`.
Source produit : `docs/product/API.md` §3.7 à §3.9, `ARCHITECTURE.md` §2, §5.
Tâche : `tasks/T-0014-dating-v1.md`.

## Périmètre livré

- Éligibilité : 18 ans révolus, questionnaire rempli, fiabilité ≥ 60.
- Questionnaire fermé (valeurs, personnalité, mode de vie) : 12 questions, aucune
  réponse libre, donc aucun texte à fuiter.
- Profil, préférences (genres recherchés, bornes d'âge), pause et reprise.
- Trois propositions par semaine (deux « similaires », une « complémentaire »),
  invitation ou passage, trois invitations maximum par semaine, expiration le lundi.
- Demande de calcul des vecteurs de rencontre (`dating.embedding_requested` v1)
  écrite dans l'outbox transactionnelle à chaque changement de questionnaire.
- Invitations reçues/envoyées, acceptation → création du date, refus, retrait.
- Date : cartes fermées uniquement, verrouillage du créneau, formule choisie par le
  payeur, commandes plafonnées par la formule, paiement (double), annulation,
  check-in par code, SOS, retour à deux, révélation du contact.

## Règles produit appliquées

| Règle | Implémentation |
|---|---|
| 18 ans révolus | `assertAdult` sur l'inscription, refus `AGE_RESTRICTED` |
| Mineur exclu partout | l'âge est la première raison, avant questionnaire et fiabilité |
| 3 propositions / semaine | `PICKS_PER_WEEK`, tirage par semaine ISO (lundi UTC) |
| 3 invitations / semaine | `assertInviteQuota`, jamais augmenté par un abonnement |
| L'invitant paie | `resolvePayer()` : refuse auto-invitation et invitation incomplète |
| Annulation gratuite jusqu'à 3 h | `canCancelDate`, sinon `CANCEL_WINDOW_CLOSED` |
| Cartes seulement | `payloadFor()` : charge utile fermée, aucun texte libre |
| Contact après « oui » mutuel | `canRevealContact` : deux `wants_contact` + date honoré |
| Machine d'états | `negotiating → awaiting_payment → confirmed → checked_in → completed`, sorties `cancelled`, `no_show`, `disputed` |
| Catalogues stables | les valeurs d'option sont des slugs (`family`, `early_bird`…), jamais un libellé ; les libellés d'affichage vivent dans `labels` |
| Embeddings | demande publiée seulement si les réponses ou `questionnaire_v` changent, dans la transaction du profil |

## Événement `dating.embedding_requested` v1

Schéma canonique : `packages/events/src/dating/dating.embedding_requested.v1.json`.
Producteur : `services/dating/src/embedding-request.ts` (validation et mapping)
et `services/dating/src/outbox.service.ts` (outbox et relais, ADR 0007).

**Co-signature dating du contrat v1** : le schéma producteur reprend sans écart le
contrat consommateur gelé par l'agent `ai` (enveloppe, trois blocs, grammaire des
slugs, échelles 1–5, rejeu par `type:id`). Dating ne demande aucune modification de
sémantique de la v1 ; toute évolution cassante passera par une v2 co-signée par
les deux agents.

| Décision | Choix v1 |
|---|---|
| Identifiants de questions et d'options | clés du catalogue `QUESTIONNAIRE_BLOCKS`, en minuscules `[a-z0-9][a-z0-9_-]{0,63}` ; aucune traduction ne les remplace |
| Version de questionnaire | `questionnaire_v` du profil, recopiée en `questionnaire_version` ; incrémenter la constante dès qu'un slug change, puis réémettre les profils |
| Déclencheur | `PUT /dating/profile` accepté, uniquement si `answers` ou `questionnaire_v` changent (comparaison canonique, ordre des clés indifférent) |
| Profil incomplet | pas d'émission si un bloc est vide : aucun signal ne serait calculable |
| `profile_id` | identifiant du profil ; en v1 la clé primaire est `user_id`, les deux champs portent la même valeur opaque |
| Publication | outbox `dating_outbox` écrite dans la même transaction que le profil ; relais assurée par `DatingOutboxService` : publication **par lot** (port `EventPublisher`, ADR 0007), disponibilité croissante 2^n minutes plafonnée à 15, déclencheur planifié (`DATING_CRON_*`) ou `POST /internal/dating/outbox/relay` (rôle `service`). Un rollback ne produit rien |
| Rejeu | le relais réutilise l'`id` de la ligne ; l'IA mémorise `type:id` et renvoie la même sortie |
| Concurrence | dernière écriture gagnante ; deux requêtes simultanées peuvent produire deux événements, l'IA les calcule indépendamment et dating conserve le profil le plus récent |
| Trace | `traceparent` de la requête HTTP recopié dans l'événement |
| Cycle de vie | pause et préférences ne changent pas les réponses, donc n'émettent rien ; une suppression de compte devra purger les vecteurs côté dating (hors v1) |
| Journalisation | jamais de réponses, de vecteurs, de numéro ni de nom |

## Vecteurs IA et propositions classées (T-0057, F4.3/F4.4)

Dating consomme `embedding.computed` (producteur `ai`, v1) et classe les propositions hebdomadaires.

- **Consommation** : `POST /internal/dating/embeddings/computed` (rôle `service`) → `EmbeddingsConsumer`.
  Idempotent par identifiant d'événement (`dating_inbox`) ; un résultat calculé pour un questionnaire
  **plus ancien** que celui du profil est ignoré (`stale`) ; profil inconnu : rien n'est enregistré, l'événement
  peut être rejoué. Vecteur invalide (≠ 64 nombres finis) : rejeté. Les vecteurs ne sont jamais journalisés.
- **Stockage** : `profile_vectors` (3 × 64 réels, migration `202611091200`), un par profil.
- **Classement** (`matching.ts`, fonctions pures) : ressemblance = 0,5·cos(valeurs) + 0,3·cos(personnalité)
  + 0,2·cos(mode de vie). Deux « ressemblants » (meilleurs scores), puis un « complémentaire » : parmi les restants
  partageant ≥ 0,3 de cosinus de valeurs, la personnalité la plus éloignée. Égalités départagées par identifiant :
  tirage reproductible. Sans vecteur, un profil reste proposable après ceux qui en ont.
- **Filtres** : âge, préférences, éligibilité, déjà vus, **quarantaine de 60 jours** après un refus d'invitation
  (dans les deux sens, borne exacte à 60 jours).
- Propositions stables pour la semaine (inchangé) ; quotas jamais augmentés par un abonnement (inchangé).

**Écarts à valider** : (1) le classement est calculé dans le service sur tableaux de réels, pas par `pgvector`
comme l'écrit la spec F4.4 — décision prise car la base de test n'a pas l'extension ; la migration vers un type
`vector` reste additive. (2) Poids 0,5/0,3/0,2 et seuil 0,3 sont des hypothèses de l'agent, à confirmer par le produit.
(3) Filtre « blocages » : aucune table de blocage n'existe encore. (4) Mesure d'équité (taux de « oui » par segment,
côté `ai`) : non faite.

## Écarts et points à valider

1. **Embeddings** : consommés et classés depuis T-0057 (voir section ci-dessus). Reste le branchement du bus réel.
2. **Paiement simulé** : aucune passerelle Payments en v1. `POST /dates/{id}/pay`
   renvoie une intention `pay_<date>` et confirme le date ; le séquestre réel viendra
   avec le service Payments sans changer les transitions.
3. **Révélation du contact** : le numéro reste dans Identity. Dating appelle
   `IDENTITY_URL/internal/users/{id}/contact` avec `SERVICE_TOKEN` ; sans ces variables,
   la route répond `INTERNAL_ERROR` explicite. L'endpoint interne Identity reste à créer.
4. **Projection Identity** : `birth_date` et `reliability` sont copiés dans le profil de
   rencontres (alimentés par les événements Identity en production).
5. **Restaurants** : seules les tables minimales (salles, créneaux, formules) existent ;
   la console restaurant et les commandes menu viendront avec Partners.
6. **Crédits** : la table existe, la consommation n'est pas encore branchée.

## Vérification

- `pnpm --filter @conexa/dating typecheck && pnpm --filter @conexa/dating test` (21 tests).
- `DATABASE_URL=… node tools/db-migrate.mjs dating` appliqué sur PostgreSQL 18 local
  (migrations `0001_init.sql` et `202610291100_outbox.sql`).
- Test d'intégration outbox (atomicité, émission unique, rejeu) :
  `DATING_TEST_DATABASE_URL=postgres://…/conexa_dating_test pnpm --filter @conexa/dating test`.
- Service démarré : `/health` 200, `/ready` `{ database: true }`, routes protégées 401.
