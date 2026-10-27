---
id: T-0030
title: "Arbitrage admin des litiges de match"
feature: F2.8
agent: football
status: in_progress
depends_on: [T-0013]
size: M
owned_paths:
  # Numéros réservés par l'orchestrateur pour ce lot de cinq tâches (F2.5, F2.6, F2.8, F2.9).
  - tasks/T-0031-*.md
  - tasks/T-0032-*.md
  - tasks/T-0033-*.md
  - tasks/T-0034-*.md
  - docs/decisions/0008-fenetre-vote-mvp.md
reads:
  - agents/football/README.md
  - docs/ROADMAP.md
  - docs/domain/football.md
  - docs/product/API.md
contracts_touched:
  - packages/contracts/src/football/index.ts
deps_request: []
human_gate: false
reviewers: [architect, security]
branch: agent/football/T-0030-litiges-competitions
worktree: ../worktrees/T-0030
pr: ""
notes: "Lot 1/5 : endpoints admin, journal d'arbitrage, transitions protégées en SQL, publication des événements par le publisher injecté."
---

## Objectif

Un administrateur consulte les matchs litigieux et tranche : résultat validé (score, faits) ou match annulé sans résultat. L'Elo et les statistiques sont appliqués une seule fois, y compris lorsqu'un match déjà validé puis contesté est corrigé.

## Contexte et règles métier

`docs/domain/football.md` : deux déclarations divergentes → `disputed` ; contestation possible 48 h après validation ; l'Elo ne s'applique qu'une fois par match. Un service ne lit jamais le schéma d'un autre (pas de table `identity`).

## À livrer

1. Contrat : `ResolveDisputeSchema`, `DisputeDetailSchema`, `AdminDisputedMatchSchema`, erreurs `DISPUTE_*`.
2. Migration `db/migrations/football/202610271600_0002_arbitration_competitions.sql` (lot « 0002 », jamais 0001) : table `match_adjudications` (journal), colonnes de fenêtres (`provisional`, `contest_closed_at`, `mvp_closed_at`).
3. Code : `GET /admin/matches/disputed`, `GET /admin/matches/:id/dispute`, `POST /admin/matches/:id/resolve`, garde `@Roles('admin')`, transitions `update … where status = 'disputed'` vérifiées.
4. Tests : qui peut trancher, décisions autorisées, effet sur Elo/statistiques/statut, correction d'un match déjà validé, double arbitrage refusé.
5. Documentation : `docs/domain/football.md` (arbitrage) et preuves de requêtes.

## Critères d'acceptation

- [ ] un joueur ou un capitaine reçoit `FORBIDDEN` sur les routes admin
- [ ] seul un match `disputed` est arbitrable (`INVALID_STATE` sinon)
- [ ] `validated` applique l'Elo et les statistiques une seule fois, statut `validated`
- [ ] `void` annule sans Elo, statut `cancelled`, aucun événement `match.validated`
- [ ] la correction d'un match contesté après validation annule puis réapplique Elo et statistiques
- [ ] chaque arbitrage écrit une ligne dans `match_adjudications` (admin, décision, note, horodatage)
- [ ] `match.validated` / `match.disputed` sont publiés par le publisher injecté

## Hors périmètre

Écrans back-office (web-core), notifications, réouverture d'un litige déjà tranché.

## Preuves attendues dans la PR

Sortie des tests unitaires, exemples `curl` des trois routes, extrait SQL du journal d'arbitrage.
