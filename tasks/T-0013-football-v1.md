---
id: T-0013
title: "Football v1 : équipes, défis, matchs, Elo, classements"
feature: F2.1
agent: football
status: todo
depends_on: [T-0010]
size: L
owned_paths:
  - services/football/**
  - db/migrations/football/**
  - packages/contracts/src/football/**
  - packages/events/src/football/**
  - docs/domain/football.md
reads:
  - docs/product/API.md#3-2-football-équipes
  - docs/product/API.md#3-3-football-terrains-défis-matchs
  - docs/product/API.md#3-5-football-classements-joueurs-badges
  - docs/decisions/0003-schema-base-reconstitue.md
contracts_touched:
  - packages/contracts/src/football/**
deps_request: []
human_gate: false
reviewers: [architect]
branch: ""
worktree: ""
pr: ""
notes: "Branche v1/football, dérivée de v1/socle. Le chat des capitaines (realtime) est hors périmètre : le match expose simplement un identifiant de fil nul."
---

## Objectif

Deux équipes se créent, se défient, jouent, déclarent le score ; Elo, statistiques et classements se mettent à jour.

## À livrer

1. Migrations `football` : terrains, créneaux, équipes, membres, invitations et demandes, défis, matchs, déclarations, événements de match, votes MVP, historique Elo, statistiques, litiges.
2. Contrats : `Team`, `Match`, `Challenge`, `EloHistory`, erreurs.
3. Endpoints : équipes (création, liste, détail, modification, effectif, invitations, demandes, départ, transfert de capitanat), terrains, défis (proposer, accepter, refuser, contre-proposer), matchs (déclaration, lecture, contestation, vote MVP, annulation, forfait), classements équipes et joueurs.
4. Règles : une équipe active par joueur, gel de 7 jours après un départ, effectif minimum 7, Elo 1000 / K=48 puis 32 / plancher 100 / non classé après 3 matchs, appliqué une seule fois par match validé.
5. `docs/domain/football.md`.

## Critères d'acceptation

- [ ] Elo testé sur des cas exacts (premiers matchs, matchs suivants, plancher, non classé)
- [ ] deux déclarations identiques valident le match une seule fois ; divergentes → `disputed`
- [ ] second rapport refusé (`REPORT_ALREADY_SUBMITTED`)
- [ ] un joueur qui rejoint une deuxième équipe → `TEAM_ALREADY_MEMBER`
- [ ] départ puis retour immédiat → `TEAM_JOIN_COOLDOWN`
- [ ] migrations appliquées sur PostgreSQL réel

## Hors périmètre

Chat des capitaines et filtre anti-chiffres, compétitions, badges avancés, écrans.

## Preuves attendues dans la PR

Tests Elo et validation de match, sortie des migrations, exemple de classement.
