---
id: T-0021
title: "Adaptateur Campay réel : collecte, statut, décaissement, webhook"
feature: F3.2
agent: money
status: review
depends_on: [T-0020]
size: L
owned_paths:
  - services/payments/**
  - packages/contracts/src/payments/**
  - docs/vendor/campay.md
reads:
  - docs/vendor/campay.md
  - docs/STACK.md#3.2
  - docs/ROADMAP.md#F3.2
contracts_touched: []
deps_request: []
human_gate: true
reviewers: [security, architect]
branch: "agent/money/T-0020-paiements-reels"
worktree: "../worktrees/T-0020"
pr: ""
notes: "Débloquée le 2026-10-27 par la collection Postman officielle et le SDK Python 1.1.0 (sources dans docs/vendor/campay.md) : endpoints, corps, statuts, solde par opérateur et signature JWT HS256 du webhook confirmés. Adaptateur réel implémenté et testé sans réseau (fetch simulé, 10 tests). RESTE À FAIRE : vérification sur l'environnement demo avec les clés (non fournies à l'agent), et observation de la durée de vie du jeton et des frais."
---

## Objectif

Brancher l'agrégateur derrière `PaymentProvider` : collecte asynchrone avec
référence, lecture de statut, décaissement, solde par opérateur — sans jamais
deviner l'API du fournisseur.

## Contexte et règles métier

- `docs/STACK.md` §3.1 confirme : opérateurs MTN/Orange seulement (ER102),
  numéros `237…` (ER101), montants entiers XAF (ER201), jeton d'application,
  environnements demo et production, collecte asynchrone rendant une `reference`
  et un statut `PENDING` puis `SUCCESSFUL`/`FAILED`, décaissement à activer
  (ER301 si solde insuffisant), solde **par opérateur**, `external_reference`.
- §3.2 non confirmé : URL exactes, webhook (existence, signature, rejeu,
  format), frais, plafonds, remboursement natif, prélèvement récurrent,
  séquestre natif, cadre juridique.

## À livrer (une fois les points bloquants levés)

1. Table de correspondance des endpoints demo/production **sourcée** dans
   `docs/vendor/campay.md`, avec la date de consultation.
2. `CampayPaymentProvider` : jeton, collecte, statut par référence, décaissement,
   solde par opérateur, traduction des erreurs ER101/ER102/ER201/ER301 en codes
   internes, `external_reference` = identifiant interne.
3. Webhook : vérification de signature selon le mécanisme réellement documenté,
   puis **relecture du statut par l'API** avant toute transition.
4. Test manuel sur l'environnement **demo** uniquement, avec preuve anonymisée
   (aucun numéro, aucune clé).

## Critères d'acceptation

- [ ] Chaque endpoint utilisé est cité dans `docs/vendor/campay.md` avec sa source.
- [ ] Aucun test automatisé ne touche le réseau (CI contre `FakeProvider`).
- [ ] Un statut de webhook non confirmé par l'API ne produit aucune transition.
- [ ] ER102 (numéro non MTN/Orange) et ER301 (solde insuffisant) ont un
      traitement nommé, pas une erreur générique.
- [ ] Preuve de collecte demo : référence, statut final, aucune donnée personnelle.

## Hors périmètre

- Production et identifiants réels.
- Le remboursement natif s'il n'existe pas (voir ADR 0007 : décaissement).

## Preuves attendues dans la PR

- Extraits de réponse demo caviardés, journal de la relève, test d'idempotence.
