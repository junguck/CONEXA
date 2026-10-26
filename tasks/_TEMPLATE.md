---
id: T-0000
title: "Titre court et précis"
feature: F0.0            # identifiant de la roadmap
agent: platform          # un seul agent propriétaire
status: todo             # todo | in_progress | review | blocked | done
depends_on: []           # autres identifiants de tâches
size: S                  # S | M | L (une tâche L doit être découpée avant démarrage)
owned_paths:             # sous-ensemble de ses chemins dans agents/ownership.yaml
  - services/example/**
reads:                   # documents à lire avant de coder
  - docs/product/API.md#3.1
  - docs/domain/example.md
contracts_touched: []    # contrats créés ou modifiés (le producteur les publie d'abord)
deps_request: []         # dépendances à ajouter hors de ses chemins (tâche web-core ou platform préalable)
human_gate: false        # true si validation humaine obligatoire (voir review_rules)
reviewers: []            # architect | security | qa
branch: ""               # rempli par l'agent : agent/<agent>/<T-id>-<slug>
worktree: ""             # rempli par l'agent : ../worktrees/<T-id>
pr: ""                   # rempli par l'agent
notes: ""                # blocage, décision prise, idée hors périmètre
---

## Objectif
Une ou deux phrases : ce que la tâche produit et pourquoi.

## Contexte et règles métier
Rappel des règles du produit qui s'appliquent (avec renvoi au document source).

## À livrer
1. Contrat (si nécessaire) : …
2. Migration : …
3. Code : …
4. Tests : …
5. Documentation (`docs/domain/<domaine>.md`, OpenAPI régénéré) : …

## Critères d'acceptation
- [ ] Critère vérifiable 1
- [ ] Critère vérifiable 2

## Hors périmètre
- Ce que l'agent ne doit pas faire dans cette tâche.

## Preuves attendues dans la PR
- Sortie des tests, captures, exemples de requêtes.
