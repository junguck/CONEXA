---
id: T-0017
title: "Service uploads : photos, logos, preuves et portfolios"
feature: F1.2
agent: platform
status: review
depends_on: [T-0010]
size: M
owned_paths:
  - services/uploads/**
  - db/migrations/uploads/**
  - packages/contracts/src/uploads/**
  - docs/domain/uploads.md
reads:
  - docs/product/API.md#1-conventions-transverses
  - docs/decisions/0003-schema-base-reconstitue.md
contracts_touched:
  - packages/contracts/src/uploads/**
  - packages/contracts/src/common/errors.ts
deps_request: []
human_gate: false
reviewers: [architect, security]
branch: v1/integration
worktree: v1-integration
pr: ""
notes: "Transversal : les domaines v1 renvoyaient déjà des `upload_id` sans route pour les créer. Pilote de stockage local en développement, S3-compatible à brancher avant production."
---

## Objectif

Permettre à un étudiant, une équipe ou un prestataire d’envoyer un fichier, de le rattacher à son objet métier et de le lire, sans qu’aucun autre service n’ait à manipuler de binaire.

## À livrer

1. Migration `uploads` : `uploads` (emplacement, contenu, empreinte, statut), `upload_attachments` (objet métier rattaché).
2. Contrats : usages, types d’objets, table de limites partagée avec le client, schémas de création et d’attachement.
3. Endpoints : création, envoi brut, métadonnées, lecture, rattachement, suppression, galerie par objet.
4. Règles : liste blanche de types, tailles par usage, type reçu identique à la déclaration, propriété, quota quotidien, plafond par objet.
5. `docs/domain/uploads.md`.

## Critères d’acceptation

- [ ] type refusé → `UPLOAD_TYPE_NOT_ALLOWED` (415) **avant** création de l’emplacement
- [ ] taille déclarée ou réelle au-delà de la limite → `UPLOAD_TOO_LARGE` (413)
- [ ] `Content-Type` reçu différent de la déclaration → refus
- [ ] écriture, rattachement et suppression réservés au propriétaire → `FORBIDDEN`
- [ ] rattachement d’un emplacement vide → `INVALID_STATE`
- [ ] plafond de fichiers par objet respecté (`profile_photo` : 1, `listing_photo` : 6)
- [ ] migration appliquée sur PostgreSQL réel, fichier écrit et relu à l’identique
- [ ] tests de règles verts (`pnpm --filter @conexa/uploads test`)

## Hors périmètre

Pilote S3 et URL présignées, antivirus, miniatures, vidéo, purge des emplacements expirés, modération d’images, quotas par plan.

## Preuves attendues dans la PR

Sortie de la migration, tests de règles, parcours `POST → PUT → GET → attach → /files` rejoué par `tests/e2e/v1-smoke.mjs`.
