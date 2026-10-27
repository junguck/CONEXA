---
id: T-0031
title: "Crons de clôture : rapport manquant, contestation 48 h, vote MVP 24 h"
feature: F2.6
agent: football
status: todo
depends_on: [T-0030]
size: M
owned_paths:
  - services/football/**
  - db/migrations/football/**
  - packages/contracts/src/football/**
  - packages/events/src/football/**
  - docs/domain/football.md
  - docs/decisions/0008-fenetre-vote-mvp.md
reads:
  - agents/football/README.md
  - docs/ROADMAP.md#trous-connus
  - docs/domain/football.md
contracts_touched:
  - packages/contracts/src/football/index.ts
deps_request: []
human_gate: false
reviewers: [architect]
branch: agent/football/T-0030-litiges-competitions
worktree: ../worktrees/T-0030
pr: ""
notes: "Lot 2/5 : trois travaux idempotents, horloge FOOTBALL_CLOCK injectée, déclenchables en test et par intervalle."
---

## Objectif

Clore automatiquement les matchs sans double déclaration, fermer la fenêtre de contestation de 48 h et figer le MVP après 24 h de vote, sans jamais rejouer un effet.

## Contexte et règles métier

Une seule déclaration au bout de 24 h est acceptée provisoirement, avec contestation possible 48 h (`agents/football/README.md`). La fenêtre de vote MVP n'était pas définie (trou n°7 de la roadmap) : l'ADR 0008 propose 24 h.

## À livrer

1. Contrat : `FootballJobSchema` / `JobRunResultSchema`, `MvpVoteSchema` inchangé ; un vote hors fenêtre répond `INVALID_STATE` (aucun code d'erreur nouveau, `packages/contracts/src/common` n'appartient pas à l'agent).
2. Migration : colonnes `provisional`, `contest_closed_at`, `mvp_closed_at`, index de balayage.
3. Code : `FootballJobsService` avec `finalizeStaleReports`, `closeContestWindows`, `closeMvpVotes` ; planificateur `setInterval` désactivable (`FOOTBALL_CRON_ENABLED`), routes `POST /internal/jobs/:name` réservées au rôle `service`.
4. Tests : bornes 24 h / 48 h, idempotence (deux exécutions = un seul effet), vote refusé après clôture, égalité de votes départagée de façon déterministe.
5. Documentation : ADR `docs/decisions/0008-fenetre-vote-mvp.md` (24 h), `docs/domain/football.md`.

## Critères d'acceptation

- [ ] un match `awaiting_reports` avec un seul rapport à H+24 est validé provisoirement, Elo appliqué une fois
- [ ] sans aucun rapport à H+24, le match est annulé (`no_report`) sans Elo
- [ ] la contestation est refusée après 48 h et le cron marque la fenêtre fermée une seule fois
- [ ] le vote MVP est refusé après 24 h et le dépouillement incrémente `mvp_count` une seule fois
- [ ] chaque travail est idempotent et journalise son bilan (compteurs, aucune PII)
- [ ] l'horloge est injectée partout (aucun `new Date()` dans les règles)

## Hors périmètre

File d'attente externe (BullMQ), notifications de clôture, écrans.

## Preuves attendues dans la PR

Sortie des tests de bornes, deux exécutions successives d'un cron (bilan identique), ADR 0008.
