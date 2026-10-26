---
id: T-0014
title: "Dating v1 : profil, picks, quotas, dates, révélation du contact"
feature: F4.3
agent: dating
status: todo
depends_on: [T-0010]
size: L
owned_paths:
  - services/dating/**
  - db/migrations/dating/**
  - packages/contracts/src/dating/**
  - packages/events/src/dating/**
  - docs/domain/dating.md
reads:
  - docs/product/API.md#3-7-rencontres-profil-et-picks
  - docs/product/API.md#3-8-rencontres-date-négociation-paiement
  - docs/decisions/0003-schema-base-reconstitue.md
  - docs/decisions/0004-nestjs-esm-vitest.md
contracts_touched:
  - packages/contracts/src/dating/**
deps_request: []
human_gate: true
reviewers: [architect, security]
branch: ""
worktree: ""
pr: ""
notes: "Branche v1/dating, dérivée de v1/socle. Validation humaine : révélation de contact. Sans pgvector, les embeddings ne sont pas calculés en v1 (ADR 0003) : les picks sont tirés parmi des profils éligibles, la règle de compatibilité viendra avec le worker IA."
---

## Objectif

Un étudiant éligible remplit son questionnaire, reçoit trois propositions par semaine, invite, accepte un date, négocie par cartes, et le contact n'est révélé qu'après un « oui » mutuel.

## À livrer

1. Migrations `dating` : profils et réponses, picks hebdomadaires, invitations, dates, cartes, commandes de date, feedback, SOS, crédits restaurant.
2. Contrats : `DatingPick`, `Date`, `DateCard`, catalogue des cartes.
3. Endpoints : éligibilité, questionnaire, profil, préférences, pause, picks, invitations, dates, catalogue et envoi de cartes, check-in, SOS, feedback, révélation du contact.
4. Règles : 18 ans révolus, 3 picks et 3 invitations par semaine (jamais augmentés par un abonnement), cartes uniquement, `resolvePayer()` isolée et testée, annulation gratuite jusqu'à 3 h, révélation seulement si les deux réponses sont « oui ».
5. `docs/domain/dating.md`.

## Critères d'acceptation

- [ ] mineur → `AGE_RESTRICTED` sur tout le module
- [ ] 4ᵉ invitation dans la semaine → `WEEKLY_QUOTA_EXCEEDED`
- [ ] `resolvePayer()` refuse les cas non couverts par la règle produit (test)
- [ ] annulation à moins de 3 h → `CANCEL_WINDOW_CLOSED`
- [ ] contact avant accord mutuel → `CONTACT_NOT_REVEALED`
- [ ] migrations appliquées sur PostgreSQL réel

## Hors périmètre

Paiement réel (interface `PaymentsGateway` avec double), réservation restaurant (partners non inclus), embeddings et worker IA, écrans.

## Preuves attendues dans la PR

Tests des quotas, du payeur, de la fenêtre d'annulation et de la révélation, sortie des migrations.
