---
id: T-0006
title: "Observabilité de base"
feature: F0.6
agent: platform
status: review
depends_on: [T-0002, T-0005]
size: M
owned_paths:
  - deploy/**
  - docs/runbooks/**
  - package.json
reads:
  - docs/STACK.md#6-observabilité
  - docs/STACK.md#8-sécurité-et-données
  - services/_template
contracts_touched: []
deps_request: []
human_gate: true
reviewers: [security]
branch: "agent/platform/T-0006-observability"
worktree: "C:\\Users\\EG\\Desktop\\Conexa\\worktrees\\T-0006"
pr: "#5"
notes: "Validation humaine obligatoire : deploy/. Aucune PII dans les logs, métriques ni libellés (le test de masquage est bloquant). Vérifié sans Docker : compose résolu (10 services), configuration validée (11 alertes, 4 tableaux de bord), masquage statique vert. Reste à exécuter sur un poste Docker : pnpm test:observability:runtime et la trace de bout en bout gateway → service → bus, qui exige le gabarit T-0005 (non livré)."
---

## Objectif

Voir ce qui se passe : traces, métriques, journaux et erreurs, avec un `traceparent` qui traverse gateway → service → bus → consommateur.

## Contexte et règles métier

`docs/STACK.md` §6. Le masquage du numéro WhatsApp, du matricule, des jetons et des numéros MoMo est obligatoire. La cardinalité des métriques est maîtrisée : jamais d'identifiant utilisateur en étiquette.

## À livrer

1. Grafana, Loki, Tempo, Prometheus dans `deploy/` (profil dev) ; intégration Sentry.
2. Tableaux de bord : santé des services, latence et erreurs par route, profondeur et échecs des files RabbitMQ, paiements (créés, séquestre, échecs), notifications.
3. Alertes de base et correspondance journaux ↔ traces par `traceparent`.
4. Test de masquage des PII ; `docs/runbooks/observability.md`.

## Critères d'acceptation

- [ ] une requête traverse gateway → service → bus → consommateur dans une seule trace
- [ ] tableau de bord des files alimenté par une vraie publication
- [ ] test de masquage vert
- [ ] aucune PII dans les journaux produits par le service d'exemple

## Hors périmètre

Métriques métier des domaines (chaque agent fournit les siennes), préproduction, Kubernetes.

## Preuves attendues dans la PR

Capture d'une trace complète, capture des tableaux de bord, sortie du test de masquage.
