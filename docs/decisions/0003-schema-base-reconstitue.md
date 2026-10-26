# ADR 0003 : les migrations v1 sont reconstituées depuis les documents produit (À VALIDER)

- **Statut** : proposé — **à valider par l'humain**
- **Date** : 2026-10-26
- **Décideur** : humain (décision de la session « v1 services »)
- **Portée** : données

## Contexte

`docs/product/schema.sql` n'a jamais été fourni (ADR 0002) alors que `schema_extension.sql` en dépend et que toutes les tâches des vagues 1 à 5 exigent de le lire. L'humain a demandé « la bd nécessaire » pour les six premiers services. Sans le fichier d'origine, les migrations sont déduites de `API.md` (schémas partagés et endpoints), `ARCHITECTURE.md` (propriété des données, sagas, règles) et `schema_extension.sql` (tables déjà écrites pour billing, marketplace, partners).

## Options

1. **Attendre `schema.sql`** : aucun service ne démarre, la v1 est vide.
2. **Reconstituer une migration par service**, marquée « À VALIDER », en respectant les contraintes connues (un schéma par service, aucun accès croisé, montants entiers, PII hors des journaux).
3. **Coder sans base** : contrats et logique sans SQL — inutilisable pour tester les règles métier.

## Décision

Option 2. Chaque service possède ses migrations dans `db/migrations/<service>/`, en SQL pur, en sens avant uniquement. Les points incertains sont marqués `-- À VALIDER` dans le SQL et listés ci-dessous. Les migrations sont appliquées et rejouées sur PostgreSQL 18 local ; elles restent révisables tant que `schema.sql` n'est pas fourni.

**Écarts assumés et à trancher :**

1. **Grand livre** : le schéma d'origine est à écriture simple ; une double écriture est requise avant F3.1 (trou n°1 de la roadmap). La v1 ne crée pas de grand livre — Payments n'est pas dans les six services.
2. **Vecteurs de rencontre** : pas d'extension `pgvector` sur les postes de développement Windows. La migration `dating` stocke les réponses et la version du questionnaire, et réserve un emplacement `embedding jsonb` marqué « À VALIDER » ; le vecteur calculé par le worker IA prendra un type `vector(64)` quand `pgvector` sera disponible (Docker, CI, production). Voir ADR 0004.
3. **Journal des consentements et suppressions** : `DELETE /me` exige une anonymisation ; la v1 pose les colonnes `deleted_at` / `anonymized_at` et l'audit admin, sans purger les données. La purge est une tâche RGPD distincte.
4. **Téléversements** : `photo_upload_id`, `evidence_upload_ids` et `file_upload_ids` sont des `uuid` sans table de stockage : le service de fichiers n'existe pas encore (aucun service prévu dans la vague 0/1). Les colonnes acceptent `null`.
5. **Notifications et push** : hors v1 (realtime non inclus).
6. **Compteurs du plan** : `talents` et `marketplace` lisent les droits par appel au service Billing, absent de la v1. L'interface `EntitlementsGateway` renvoie des droits par défaut et est testée avec un double.
7. **Politiques RLS** : non reprises (ARCHITECTURE.md §4 : le contrôle d'accès est fait dans le service à partir du JWT).

## Conséquences

- Les six services démarrent et leurs règles testables tournent sur une vraie base.
- Une revue `review:architect-ok` sur chaque migration est obligatoire avant fusion ; un changement après fusion passe par une nouvelle migration.
- Quand `schema.sql` arrive, les écarts se corrigent par de nouvelles migrations, jamais en réécrivant celles-ci.

## Validation

1. `docs/product/schema.sql` comparé table par table aux migrations des six services.
2. Décision explicite sur : `pgvector` (quand l'activer), la purge RGPD, le service de fichiers.
3. `human-ok` sur la branche qui porte les migrations.
