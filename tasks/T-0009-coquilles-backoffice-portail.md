---
id: T-0009
title: "Coquilles du back-office et du portail partenaire"
feature: F0.9
agent: web-core
status: todo
depends_on: [T-0007]
size: S
owned_paths:
  - apps/backoffice/**
  - apps/partner-portal/**
reads:
  - docs/STACK.md#2-compléments-recommandés-à-confirmer
  - docs/product/API.md#3-endpoints
  - docs/STACK.md#2-compléments-recommandés-à-confirmer
  - tasks/T-0007-design-system-coquille-web-pwa.md
contracts_touched: []
deps_request: []
human_gate: false
reviewers: []
branch: ""
worktree: ""
pr: ""
notes: "Dépend du socle web (T-0007). Le portail doit rester utilisable sur téléphone : le personnel du restaurant l'utilise en service."
---

## Objectif

Deux apps front prêtes à recevoir les écrans des domaines, avec la même base que `apps/web`.

## Contexte et règles métier

Rôles `admin`, `moderator` (back-office) et `partner_staff`/`restaurant_staff` (portail). Le portail ne montre jamais le numéro WhatsApp ni le matricule d'un étudiant : prénom et photo seulement.

## À livrer

1. `apps/backoffice` et `apps/partner-portal` : `packages/ui`, client typé, gardes de rôle, navigation générée par registre (`(admin)/<domaine>`, `(portal)`).
2. Mise en page adaptée : tables, filtres, formulaires côté admin ; usage tablette et téléphone côté portail.
3. Authentification par rôle et page d'accueil de chaque app.

## Critères d'acceptation

- [ ] un domaine d'exemple ajoute une page en ne créant que ses propres fichiers
- [ ] garde de rôle testée (mauvais rôle → refus)
- [ ] portail utilisable à 390 px de large sans débordement

## Hors périmètre

Écrans métier de chaque domaine.

## Preuves attendues dans la PR

Sortie des tests de garde de rôle, captures à 390 px et 1280 px, diff de l'ajout d'une page de domaine.
