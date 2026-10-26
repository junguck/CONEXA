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
notes: "Périmètre IA de F4.3 (+ fonction Rocchio de F4.6) : le questionnaire, l'éligibilité et la persistance restent chez dating. L'ADR 0003 est exigé par F4.3 mais docs/decisions appartient à architect → review:architect-ok. Le producteur dating.embedding_requested n'existe pas encore : forme consommateur décrite dans l'ADR, à publier par dating avant l'intégration de bout en bout. Les schémas d'événements sont posés en JSON dans packages/events/src/ai/ en attendant le générateur de F0.4. Pas de package.json : un paquet de workspace sans dépendance casse pnpm --frozen-lockfile ; tâche platform à créer pour l'intégration Turborepo/CI. Extension : boucle d'événements, adaptateur Redis et contrat consommateur v1 (document + corpus de 22 fixtures) inclus dans la même branche avant fusion, sans dépendance ajoutée ; le client Redis réel reste à fournir par platform (F0.2) et le schéma producteur canonique par dating. Collision de numéro : origin/main contient désormais tasks/T-0010-socle-v1-services.md ; l'orchestrateur doit renuméroter cette tâche avant fusion."
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
6. Contrat consommateur `dating.embedding_requested` v1 et handoff vers `dating` (`contracts/dating.embedding_requested.handoff.md`) : document `services/ai-worker/contracts/`, corpus `tests/fixtures/consumer/` (3 valides, 19 refus) et matrice de rejet ; durcissements associés (version d'enveloppe 1, fuseau obligatoire, trois blocs requis, options distinctes).
7. Audit d'intégration du producteur `dating` : événement réellement émis (catalogue v1) accepté par le worker, fixture `valid/dating-catalogue.json`, écarts compatibles et blocages restants documentés dans `contracts/dating-integration-audit.md`.
8. Extension (même branche, avant fusion) : `runtime.py` — boucle pilotée par un `Delivery` avec `ack`/`reject`, publication avant acquittement, rejet sans boucle, lot vide acquitté sans publication. `idempotency.py` — protocole `IdempotencyStore` et adaptateur `RedisIdempotencyStore` (JSON, `SET EX`, espace de clés, erreur sur entrée corrompue), sans ajouter de dépendance.

## Critères d'acceptation

- [x] encodage déterministe testé (même entrée = mêmes octets, indépendant de l'ordre des choix)
- [x] rejeu idempotent : même identifiant d'événement = même résultat, un seul calcul
- [x] trois blocs de 64 dimensions, norme L2 = 1 (bloc vide = vecteur nul documenté)
- [x] mise à jour Rocchio testée sur cas connus (α = 0,1, β = 0,05)
- [x] aucune réponse, aucun vecteur dans les journaux
- [x] boucle : publication avant `ack`, événement invalide rejeté et consigné, panne du sink non acquittée
- [x] rejeu via Redis sans recalcul, entrée corrompue refusée (`IdempotencyError`)
- [x] contrat consommateur : chaque fixture valide est acceptée, chaque refus l'est pour la raison documentée, aucun fichier orphelin
- [x] audit producteur : événement réel `dating` accepté (3 vecteurs), écarts restrictifs documentés
- [x] `python3 -m unittest discover -s tests -v` vert (59 tests)

## Hors périmètre

Questionnaire et éligibilité (dating), migration `dating_profiles`, stockage pgvector, propositions hebdomadaires, API interne, écrans, mesure d'équité (F4.4), modèles d'embeddings neuronaux.

## Preuves attendues dans la PR

Sortie de `python3 -m unittest discover -s tests -v`, exemple d'événement d'entrée/sortie via `python3 -m conexa_ai_worker`, schémas JSON validés, ADR 0003.
