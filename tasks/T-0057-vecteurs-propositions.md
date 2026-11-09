---
id: T-0057
title: "Dating : vecteurs IA consommés, propositions classées par cosinus, quarantaine"
feature: F4.4
agent: dating
status: review
depends_on: [T-0035]
size: M
owned_paths:
  - services/dating/**
  - db/migrations/dating/**
  - docs/domain/dating.md
reads:
  - docs/domain/ai.md
  - packages/events/src/ai/embedding.computed.v1.json
  - docs/domain/dating.md
contracts_touched: []
deps_request: []
human_gate: false
reviewers: [architect, qa]
branch: agent/dating/T-0057-vecteurs-propositions
worktree: ../worktrees/T-0057
pr: ""
notes: "Classement en TypeScript sur tableaux de réels, pas pgvector (spec F4.4) : voir docs/domain/dating.md. Corrige au passage une assertion fausse du test d'intégration de T-0035 (comparait un objet à une chaîne). Testé sur un vrai PostgreSQL embarqué."
---

## Objectif

Utiliser les vecteurs calculés par le worker IA pour classer les trois propositions de la semaine,
avec quarantaine de 60 jours après un refus.

## Critères d'acceptation

- [x] Consommation idempotente de `embedding.computed`, résultats périmés ignorés.
- [x] Classement cosinus pondéré reproductible sur un jeu de données connu.
- [x] Quarantaine de 60 jours testée (59 j / 60 j exacts) et sur base réelle.
- [x] Propositions stables pour la semaine, aucun accès à un autre schéma.
- [ ] Mesure d'équité par `ai` (hors périmètre).
- [ ] Filtre des blocages (aucune table de blocage).

## Hors périmètre

- pgvector, mesure d'équité, branchement du bus réel.
