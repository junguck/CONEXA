---
id: T-0033
title: "Compétitions : poules, phases finales et progression"
feature: F2.9
agent: football
status: review
depends_on: [T-0032]
size: M
owned_paths:
  - services/football/**
  - db/migrations/football/**
  - packages/contracts/src/football/**
  - packages/events/src/football/**
  - docs/domain/football.md
reads:
  - docs/ROADMAP.md
  - docs/domain/football.md
contracts_touched:
  - packages/contracts/src/football/index.ts
deps_request: []
human_gate: false
reviewers: [architect]
branch: agent/football/T-0030-litiges-competitions
worktree: ../worktrees/T-0030
pr: ""
notes: "Lot 4/5 : tirage en poules, arbre à élimination directe, forfaits et litiges d'un match de compétition."
---

## Objectif

Générer les poules d'une compétition et l'arbre des phases finales, puis faire avancer le tableau quand un match est validé.

## Contexte et règles métier

F2.9 (poules, phases finales). Un match de compétition suit les règles de match existantes (déclaration, litige, Elo) ; l'arbitrage d'un litige met aussi à jour le tableau. Une place de phase finale est occupée une seule fois (contrainte unique).

## À livrer

1. Contrat : `GenerateGroupsSchema`, `GenerateBracketSchema`, `BracketSlotSchema`, `AdvanceStageSchema`.
2. Code : `POST /competitions/:id/groups`, `POST /competitions/:id/bracket`, `GET /competitions/:id/bracket`, `POST /competitions/:id/advance` (admin) ; rattachement d'un match à une place et résolution du vainqueur (y compris forfait et annulation).
3. Tests : répartition déterministe des équipes, refus d'un tableau incomplet, avancement idempotent, refus de rejouer une place déjà décidée.
4. Documentation : section poules/phases finales de `docs/domain/football.md`.

## Critères d'acceptation

- [ ] les poules se génèrent de façon déterministe et équilibrée (écart d'une équipe au plus)
- [ ] un tableau à élimination directe a `2^n` places et `n` tours
- [ ] valider un match remplit la place suivante une seule fois
- [ ] annuler un match de phase finale laisse la place vide et le signale
- [ ] toutes les transitions sont protégées en SQL (`where status = …`)

## Hors périmètre

Calendrier automatique des poules, classement fair-play, écrans.

## Preuves attendues dans la PR

Exemple de tableau généré et d'avancement, sortie des tests.
