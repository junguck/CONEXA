---
id: T-0007
title: "Design system et coquille de l'app web (PWA)"
feature: F0.7
agent: web-core
status: todo
depends_on: [T-0001]
size: M
owned_paths:
  - packages/ui/**
  - apps/web/**
reads:
  - docs/STACK.md#2-compléments-recommandés-à-confirmer
  - docs/product/API.md#1-conventions
  - docs/product/API.md#2-schémas-partagés
  - docs/product/design/DESIGN_HANDOFF.md
  - docs/product/design/LISEZ-MOI.md
contracts_touched: []
deps_request: []
human_gate: false
reviewers: []
branch: ""
worktree: ""
pr: ""
notes: "Le document produit « docs/product/README.md » (§16, écrans) est absent (voir ADR 0002) : démarrer sur les maquettes fournies et signaler le manque dans la PR. Contrat d'API typé à brancher seulement après fusion de T-0004."
---

## Objectif

Le socle visuel et technique du front : jetons, composants, coquille mobile, PWA installable, navigation générée par registre.

## Contexte et règles métier

`docs/STACK.md` §2 : shadcn/ui (Radix), React Hook Form + Zod, TanStack Query, Serwist, `web-push`. Maquettes et handoff dans `docs/product/design/`. Aucune règle métier côté front : le serveur décide, le front affiche. Textes en français (clés i18n).

## À livrer

1. `packages/ui` : jetons Tailwind, mode sombre, composants (Button, Input, Select, Dialog, Sheet, Tabs, Toast, Avatar, Badge, Skeleton, EmptyState, Table), page de démonstration.
2. `apps/web` : Next.js App Router, navigation basse mobile, gardes d'authentification et de rôle, TanStack Query, client d'API typé depuis `@conexa/contracts`, gestion des codes d'erreur métier, i18n français.
3. PWA : manifeste, icônes, page hors-ligne, invite de mise à jour, abonnement push VAPID.
4. `pnpm gen:registry` : navigation construite depuis `src/features/*/nav.ts`.

## Critères d'acceptation

- [ ] installable en PWA (audit Lighthouse joint)
- [ ] ajouter un écran de démonstration ne crée que des fichiers dans un dossier de domaine
- [ ] tests de composants verts
- [ ] aucun fichier partagé édité pour ajouter un écran

## Hors périmètre

Écrans métier (chaque agent de domaine possède les siens), back-office et portail partenaire (T-0009).

## Preuves attendues dans la PR

Audit Lighthouse, capture des composants, sortie des tests, diff de l'ajout d'écran.
