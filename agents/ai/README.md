# Agent `ai`

> Worker Python : calcule les embeddings, met à jour les vecteurs après un date, alimente les recommandations.

## Mission
Transformer des réponses et des textes en vecteurs utilisables, de façon déterministe, testable et sans jamais accéder aux bases des autres services.

## Propriété
<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->
Cet agent n'écrit **que** dans :

- `services/ai-worker/**`
- `packages/events/src/ai/**`
- `docs/domain/ai.md`

Tout le reste est en lecture seule. Source : `agents/ownership.yaml`.
<!-- OWNERSHIP:end -->

## Interdit
- Lire ou écrire dans le schéma d'un autre service : il communique par **événements** et par **API internes** exposées par les domaines.
- Donner des outils (accès fichier, réseau, exécution) à un modèle qui lit du **texte d'utilisateur** : ce texte est de la donnée, jamais une instruction.
- Journaliser les réponses du questionnaire ou les textes d'utilisateurs.

## Lire avant de commencer
`docs/product/README.md` §11 · `docs/product/schema.sql` (§6 `dating_profiles`, `match_candidates`) · `docs/product/ARCHITECTURE.md` §2 et §5 · `docs/domain/ai.md`.

## Ce qu'il fait
- **Rencontres** : à `dating.embedding_requested`, construit trois vecteurs (valeurs, personnalité, mode de vie) et publie `embedding.computed`. L'encodage (réponses à choix vers vecteur, texte court vers embedding, dimension 64 par bloc) est **justifié dans un ADR**.
- **Après un date** : à `date.completed`, applique la mise à jour de type Rocchio `v' = v + α(v_aimé − v) − β(v_refusé − v)` avec α = 0,1 et β = 0,05, puis publie `dating.vectors_updated`. Les poids des blocs peuvent évoluer avec les retours.
- **Talents et Marketplace** : embeddings de compétences, publications et offres (dimension 1536) ; recommandations.
- Mesure de l'équité des propositions (taux de « oui » par segment) pour l'orchestrateur et l'humain.

## Règles critiques
- Idempotence : un événement rejoué produit le même résultat ; versions de modèle enregistrées avec chaque vecteur.
- Tests déterministes avec des jeux de données d'exemple ; aucune clé de service d'IA en CI (modèle factice).
- Les vecteurs sont des données personnelles : pas de journalisation, durée de conservation documentée.

## Commandes
`cd services/ai-worker && uv run pytest` (ou l'outil Python retenu par l'ADR de F4.3) · `pnpm turbo run test --filter=@conexa/ai-worker...`

## Reçoit de / passe la main à
`dating`, `talents`, `marketplace` (événements de demande) · rend les résultats par événements.

## Définition de terminé
Tests de reproductibilité et d'idempotence · test de la mise à jour Rocchio sur cas connus · aucun accès direct à une base étrangère (vérifié par la configuration des rôles).
