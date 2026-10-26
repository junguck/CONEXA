---
id: T-0012
title: "Identity v1 : OTP, JWT, profil, validation admin"
feature: F1.1
agent: identity
status: review
depends_on: [T-0010]
size: L
owned_paths:
  - services/identity/**
  - db/migrations/identity/**
  - packages/contracts/src/identity/**
  - packages/events/src/identity/**
  - docs/domain/identity.md
reads:
  - docs/product/API.md#3-1-authentification-et-compte
  - docs/product/API.md#3-14-admin-et-modération
  - docs/product/ARCHITECTURE.md#11-sécurité-entre-services
  - docs/decisions/0003-schema-base-reconstitue.md
contracts_touched:
  - packages/contracts/src/identity/**
deps_request: []
human_gate: true
reviewers: [architect, security]
branch: "v1/identity"
worktree: "../worktrees/v1-identity"
pr: ""
notes: "Branche v1/identity, dérivée de v1/socle. Validation humaine obligatoire : authentification. Fournisseur OTP = console en développement (aucun envoi réel) ; le fournisseur WhatsApp reste à trancher (ADR à écrire avant la production)."
---

## Objectif

Un étudiant demande un code, le valide, reçoit un jeton, complète son profil, et un administrateur valide son inscription.

## À livrer

1. Migrations `identity` : utilisateurs, codes OTP hachés, jetons de rafraîchissement, audit admin, blocages, signalements, fiabilité.
2. Contrats : OTP, inscription, profil, `Me`/`PublicUser`, erreurs associées.
3. Endpoints : `/auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout`, `/me/register`, `/me`, `PATCH /me`, `/me/reliability`, `/filieres`, `/users/{id}`, `/reports`, `/admin/users` (file d'attente), `/admin/users/{id}/approve|reject`.
4. JWT RS256 signés par le service, JWKS exposé, jetons de rafraîchissement à rotation avec détection de réutilisation.
5. Règle PII : le numéro WhatsApp n'est jamais renvoyé ni journalisé en clair (`whatsapp_masked` seulement).

## Critères d'acceptation

- [ ] OTP : 5 minutes, 5 essais, code haché, demande limitée
- [ ] jeton expiré refusé ; rafraîchissement rejoué détecté et la session révoquée
- [ ] matricule en double → `MATRICULE_TAKEN`
- [ ] compte `pending` ne peut pas utiliser l'application (`ACCOUNT_PENDING`)
- [ ] aucun numéro en clair dans les réponses, journaux ou événements (test)
- [ ] migrations appliquées sur PostgreSQL réel

## Hors périmètre

Push et notifications, écrans, OTP WhatsApp réel, suppression RGPD complète.

## Preuves attendues dans la PR

Tests, sortie des migrations, exemple de jeton et de JWKS.
