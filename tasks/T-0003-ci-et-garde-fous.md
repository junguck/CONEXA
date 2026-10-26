---
id: T-0003
title: "CI et garde-fous (propriété, contrats, migrations)"
feature: F0.3
agent: platform
status: in_progress
depends_on: [T-0001]
size: M
owned_paths:
  - .github/**
  - tools/**
  - package.json
  - docs/domain/platform.md
reads:
  - agents/README.md
  - agents/GIT_WORKFLOW.md
  - agents/ownership.yaml
  - docs/STACK.md#8-sécurité-et-données
  - docs/STACK.md#9-conseils-d-ingénierie-agentique
contracts_touched: []
deps_request: []
human_gate: true
reviewers: [security]
branch: "agent/platform/T-0003-ci-guardrails"
worktree: "C:\\Users\\EG\\Desktop\\Conexa\\worktrees\\T-0003"
pr: ""
notes: "Validation humaine obligatoire : tout changement dans .github/. C'est ce contrôle qui rend le travail multi-instances sûr : il refuse une PR qui touche le chemin d'un autre agent."
---

## Objectif

Une CI qui refuse automatiquement les collisions de propriété, les ruptures de contrat, les migrations réécrites, les secrets et les PII dans les journaux.

## Contexte et règles métier

`agents/ownership.yaml` est la source de vérité des chemins. `agents/GIT_WORKFLOW.md` §5–§7 fixe les conditions de fusion. Le contrôle est **bloquant**, jamais consultatif, avec un message qui dit quel fichier, quel agent et quelle règle.

## À livrer

1. `.github/workflows` : lint, types, tests, build ciblés (`--filter=...[origin/main]`), tests d'intégration, `gitleaks`, `pnpm audit`, `pnpm install --frozen-lockfile`.
2. `tools/check-ownership` : lit `ownership.yaml`, le fichier de tâche et le diff ; échoue si un fichier modifié sort des chemins de l'agent (identifié par le nom de branche) ou de `owned_paths`.
3. `tools/check-migrations` : nom horodaté, ordre, interdiction de modifier une migration déjà fusionnée, drapeau si destructrice.
4. `tools/check-contracts` : `oasdiff` sur l'OpenAPI et compatibilité des schémas d'événements.
5. Test de masquage des PII dans les journaux ; `.github/pull_request_template.md` ; `CODEOWNERS` ; étiquettes de revue ; tests des outils eux-mêmes.

## Critères d'acceptation

- [ ] PR d'exemple touchant un chemin étranger → CI rouge, message explicite
- [ ] migration fusionnée modifiée → rouge
- [ ] champ de contrat supprimé → rouge
- [ ] secret factice → rouge
- [ ] `pnpm tools:check-ownership` utilisable en local

## Hors périmètre

Déploiement, préproduction, production.

## Preuves attendues dans la PR

Quatre PR d'exemple avec la sortie CI correspondante, et les tests des outils.
