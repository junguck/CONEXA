# ADR 0003 : construction des vecteurs de rencontre

- **Statut** : proposé
- **Date** : 2026-10-26
- **Décideur** : agent `ai` (proposition soumise à `review:architect-ok` et `review:security-ok`)
- **Portée** : données | contrats | sécurité

## Contexte

F4.3 exige un ADR de l'agent `ai` **avant** de coder l'encodage des réponses du questionnaire de rencontre. `agents/ai/README.md` fixe le cadre : trois blocs (`values`, `personality`, `lifestyle`), **64 dimensions par bloc**, un `embedding.computed` publié par le worker, et une mise à jour de type Rocchio après un date (`v' = v + α(v_aimé − v) − β(v_refusé − v)`, α = 0,1, β = 0,05).

Contraintes qui pèsent sur le choix :

- `docs/product/schema.sql` est absent (ADR 0002). Aucune forme de table, aucun type d'option, aucune contrainte d'index ne peut être supposée.
- `docs/STACK.md` §6 : le contenu utilisateur est une **donnée**, jamais une instruction ; le worker ne fait que calculer des embeddings.
- Aucune clé de fournisseur d'IA en CI, tests déterministes obligatoires, vecteurs = données personnelles non journalisées.
- Le worker est en Python, séparé des services NestJS ; il ne lit ni n'écrit aucune base d'un autre service.

## Options

1. **Hachage déterministe des jetons de réponse** (feature hashing signé, SHA-256). Chaque question et chaque option devient un jeton stable, projeté sur 64 dimensions avec un signe ; les échelles 1–5 sont encodées par un noyau triangulaire pour conserver l'ordinalité ; multi-choix = somme des jetons. Aucune dépendance, aucun modèle à télécharger, résultat identique sur toute machine et en CI, versionné (`dating-qhash-v1`). Qualité sémantique limitée : deux options voisines non déclarées proches ne se ressemblent pas — acceptable parce que le questionnaire est un **catalogue fermé** de choix connus, pas du texte libre.
2. **Modèle multilingue open source** (sentence-transformers). Meilleure similarité sémantique, mais image lourde, modèle à épingler et à télécharger, faux modèle obligatoire en CI, empreinte mémoire et latence à mesurer, et risque de dériver si la version du modèle change. Coût de sortie plus élevé que l'option 1 pour un gain non démontré sur des options fermées.
3. **API d'embeddings distante** (1536 dimensions). Aucun modèle à héberger, mais coût par appel, dépendance réseau, données personnelles envoyées à un tiers, clé de service à gérer, et dimension incompatible avec les 64 demandées.
4. **Ne rien décider** : F4.3 reste bloquée ; dating ne peut pas produire `dating.embedding_requested`.

## Décision

**Option 1** pour la v1 des rencontres : encodage par hachage déterministe signé, trois blocs de 64 dimensions, `model_version = dating-qhash-v1`, interface `EmbeddingModel` permettant de remplacer l'encodeur par un modèle (option 2) sans changer les contrats d'événements.

Détails opposables :

- **Jeton** : `question_id` + valeur de réponse (option stable, jamais le libellé français). Les réponses sont des identifiants de choix (`[a-z0-9][a-z0-9_-]*`, 64 caractères au plus) ou des entiers 1–5 ; tout texte libre est refusé par validation, pas seulement tronqué. Un futur champ texte devra passer par un modèle, pas par ce hash.
- **Projection** : `SHA-256("dating-qhash-v1|<jeton>")` étendu par compteur, valeurs dans [−1, 1], somme pondérée, normalisation L2, arrondi à 9 décimales. Aucun `hash()` Python : `PYTHONHASHSEED` ne doit pas changer le résultat.
- **Échelles** : la réponse `v` alimente les niveaux `L` de 1 à 5 avec le poids `max(0, 1 − |v − L| / 2)`. Deux réponses voisines partagent la moitié de leur signal ; 1 et 5 ne partagent rien.
- **Bloc vide** : vecteur nul de 64 dimensions, jamais normalisé. Il signifie « questionnaire incomplet » et ne doit pas entrer dans une similarité cosinus (le filtrage appartient à dating).
- **Similarité** : cosinus, conforme à F4.4. Les trois blocs sont comparés séparément puis pondérés par dating ; l'ADR ne fixe pas les poids produit.
- **Rocchio** : appliqué bloc par bloc, puis renormalisé L2. Un seul partenaire par date : un « oui » applique le terme α, un refus le terme −β (les deux termes ne servent qu'au traitement par lot). `update_model_version = dating-rocchio-v1`.
- **Versionnage** : `model_version` accompagne chaque vecteur publié. Changer la projection, les poids d'échelle ou les dimensions impose un nouveau `model_version` et un recalcul, jamais une réécriture silencieuse.
- **Idempotence** : clé = `type` + `id` de l'événement. Le worker mémorise le résultat produit et le rejoue à l'identique ; la version du modèle est incluse dans la clé.
- **Confidentialité** : le worker journalise uniquement type et identifiant d'événement, nombre de blocs, durée. Aucune réponse, aucun vecteur, aucun numéro. Persistance des vecteurs : dating (pgvector), pas le worker.

## Conséquences

- F4.3 (partie IA) peut démarrer sans modèle externe ni clé ; les tests tournent hors ligne et en CI.
- La forme du payload d'entrée `dating.embedding_requested` est **proposée** par cet ADR (réponses groupées par bloc, identifiants seulement). Le producteur reste dating : il doit publier son contrat v1 avant l'intégration de bout en bout.
- Les schémas `embedding.computed` et `dating.vectors_updated` sont posés dans `packages/events/src/ai/` ; F0.4 les branchera sur son générateur et son enveloppe commune.
- Un passage à un modèle neuronal exigera un ADR de remplacement, une version de modèle par défaut, un faux modèle en CI et une mesure de coût. Les contrats ne changent pas.
- La qualité des propositions reste à mesurer (taux de « oui » par segment, F4.4) : si elle est insuffisante, l'option 2 est réévaluée avec des chiffres.

## Validation

`review:architect-ok` (contrats et versionnage) et `review:security-ok` (données personnelles, journalisation, absence de texte libre). `human-ok` non requis : la révélation de contact et l'argent ne sont pas concernés. Reste à vérifier avant production : qualité réelle des rapprochements sur un jeu de réponses étudiantes, et durée de conservation des vecteurs côté dating.
