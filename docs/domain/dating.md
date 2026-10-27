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

## Écarts et points à valider

1. **Embeddings absents (ADR 0006, T-0014)** : sans pgvector, les propositions sont
   tirées parmi les profils éligibles. Le worker IA remplacera ce tirage par une
   similarité cosinus (deux similaires + une complémentaire).
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

- `pnpm --filter @conexa/dating typecheck && pnpm --filter @conexa/dating test` (13 tests).
- `DATABASE_URL=… node tools/db-migrate.mjs dating` appliqué sur PostgreSQL 18 local.
- Service démarré : `/health` 200, `/ready` `{ database: true }`, routes protégées 401.
