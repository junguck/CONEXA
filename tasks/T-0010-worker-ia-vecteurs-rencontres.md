---
id: T-0010
title: "Worker IA : vecteurs de rencontre et mise à jour après date"
feature: F4.3
agent: ai
status: review
depends_on: []
size: M
owned_paths:
  - services/ai-worker/**
  - packages/events/src/ai/**
  - docs/domain/ai.md
  - docs/decisions/0003-vecteurs-rencontres.md
reads:
  - docs/product/ARCHITECTURE.md
  - docs/product/API.md
  - agents/ai/README.md
  - agents/dating/README.md
  - agents/ownership.yaml
contracts_touched:
  - packages/events/src/ai/embedding.computed.v1.json
  - packages/events/src/ai/dating.vectors_updated.v1.json
deps_request: []
human_gate: false
reviewers: [architect, security]
branch: "agent/ai/T-0010-dating-embeddings"
worktree: "../worktrees/T-0010"
pr: ""
notes: "Périmètre IA de F4.3 (+ fonction Rocchio de F4.6) : le questionnaire, l'éligibilité et la persistance restent chez dating. L'ADR 0003 est exigé par F4.3 mais docs/decisions appartient à architect → review:architect-ok. Le producteur dating.embedding_requested n'existe pas encore : forme consommateur décrite dans l'ADR, à publier par dating avant l'intégration de bout en bout. Les schémas d'événements sont posés en JSON dans packages/events/src/ai/ en attendant le générateur de F0.4. Pas de package.json : un paquet de workspace sans dépendance casse pnpm --frozen-lockfile ; tâche platform à créer pour l'intégration Turborepo/CI."
---

## Objectif

Démarrer la partie IA du domaine rencontres : transformer des réponses de questionnaire en trois vecteurs déterministes (valeurs, personnalité, mode de vie) et appliquer la mise à jour Rocchio après un date.

## Contexte et règles métier

`agents/ai/README.md` : trois vecteurs de 64 dimensions par bloc, encodage justifié par un ADR, publication de `embedding.computed`, puis `dating.vectors_updated` après `date.completed` (α = 0,1, β = 0,05). `docs/product/API.md` §3.7 définit les blocs du questionnaire et précise que les vecteurs ne sont jamais exposés au client. `docs/product/schema.sql` est absent (ADR 0002) : aucune migration, aucun accès base, aucun stockage de vecteur par ce worker.

## À livrer

1. ADR 0003 : construction des vecteurs, versions de modèle, alternatives écartées.
2. `services/ai-worker` : paquet Python sans dépendance externe, encodage déterministe, mise à jour Rocchio, validation d'enveloppe, idempotence par identifiant d'événement, journalisation sans réponse ni vecteur.
3. Contrats des événements produits : `embedding.computed` v1, `dating.vectors_updated` v1.
4. Tests : déterminisme, dimensions, ordinalité des échelles, ordre des choix multiples, rejeu idempotent, cas Rocchio calculés à la main, absence de PII dans les journaux.
5. `docs/domain/ai.md` : pipeline, contrats, exploitation, limites.

## Critères d'acceptation

- [x] encodage déterministe testé (même entrée = mêmes octets, indépendant de l'ordre des choix)
- [x] rejeu idempotent : même identifiant d'événement = même résultat, un seul calcul
- [x] trois blocs de 64 dimensions, norme L2 = 1 (bloc vide = vecteur nul documenté)
- [x] mise à jour Rocchio testée sur cas connus (α = 0,1, β = 0,05)
- [x] aucune réponse, aucun vecteur dans les journaux
- [x] `python3 -m unittest discover -s tests -v` vert (36 tests)

## Hors périmètre

Questionnaire et éligibilité (dating), migration `dating_profiles`, stockage pgvector, propositions hebdomadaires, API interne, écrans, mesure d'équité (F4.4), modèles d'embeddings neuronaux.

## Preuves attendues dans la PR

Sortie de `python3 -m unittest discover -s tests -v`, exemple d'événement d'entrée/sortie via `python3 -m conexa_ai_worker`, schémas JSON validés, ADR 0003.
