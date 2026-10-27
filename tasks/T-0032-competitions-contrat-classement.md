---
id: T-0032
title: "Compétitions : contrat, tables et classement"
feature: F2.9
agent: football
status: review
depends_on: [T-0030]
size: M
owned_paths:
  - services/football/**
  - db/migrations/football/**
  - packages/contracts/src/football/**
  - packages/events/src/football/**
  - docs/domain/football.md
reads:
  - docs/ROADMAP.md
  - agents/football/README.md
  - docs/domain/football.md
contracts_touched:
  - packages/contracts/src/football/index.ts
deps_request: []
human_gate: false
reviewers: [architect]
branch: agent/football/T-0030-litiges-competitions
worktree: ../worktrees/T-0030
pr: ""
notes: "Lot 3/5 : contrat d'abord, migration 0002 non modifiable ensuite, création/inscription/classement."
---

## Objectif

Créer une compétition, y inscrire des équipes, générer des poules et tenir un classement de compétition distinct du classement Elo de la saison.

## Contexte et règles métier

F2.9 : poules et phases finales. Le classement de compétition comptabilise les matchs rattachés à la compétition (3 points victoire, 1 nul, 0 défaite, différence de buts), pas l'Elo. Une équipe ne joue qu'une compétition active à la fois pour une même édition.

## À livrer

1. Contrat : `CompetitionSchema`, `CreateCompetitionSchema`, `CompetitionStandingRowSchema`, `CompetitionStageSchema`.
2. Migration : `competitions`, `competition_teams` (avec `group_no`), `competition_slots`, colonne `matches.competition_id` (nullable, FK interne au schéma).
3. Code : `POST /competitions`, `GET /competitions`, `GET /competitions/:id`, `POST /competitions/:id/teams`, `GET /competitions/:id/standings`.
4. Tests : refus d'une équipe non active, refus d'un doublon, classement (points, différence, buts marqués), isolation par compétition.
5. Documentation : section compétitions de `docs/domain/football.md`.

## Critères d'acceptation

- [ ] une compétition a un format (`league`, `groups`, `knockout`) et un statut (`draft`, `active`, `finished`)
- [ ] seules des équipes actives sont inscrites, une fois chacune
- [ ] le classement trie points puis différence puis buts marqués puis identifiant d'équipe
- [ ] un match hors compétition ne change pas le classement de compétition
- [ ] la migration 0002 ne touche pas 0001

## Hors périmètre

Génération des rencontres, phases finales (T-0033), écrans.

## Preuves attendues dans la PR

Exemple de classement, sortie des tests, extrait de migration.
