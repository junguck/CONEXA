---
id: T-0028
title: "Rendre la CI de main verte (audit de dépendances, fuite gitleaks)"
feature: F0.3
agent: orchestrator
status: review
depends_on: [T-0051, T-0003]
size: S
owned_paths:
  - pnpm-workspace.yaml
  - pnpm-lock.yaml
  - package.json
  - .gitleaksignore
reads:
  - .github/workflows/ci.yml
  - docs/domain/platform.md
  - tasks/T-0003-ci-et-garde-fous.md
contracts_touched: []
deps_request: []
human_gate: false
reviewers: [platform]
branch: ""
worktree: ""
pr: ""
notes: "Deux étapes de la CI de push sur main échouaient, aucune des deux n'était régressée par la fusion du bus (T-0051) : (1) « Audit des dépendances » — @nestjs/platform-express épingle exactement multer 2.4.0, vulnérable (GHSA-q7qp-rjg7-q26m, high) ; pnpm 12 ne lit plus pnpm.overrides depuis package.json, l'override vit dans pnpm-workspace.yaml et porte la transitive à 2.5.0 (audit vert, install --frozen-lockfile vert). (2) « gitleaks (historique git) » — un faux positif de la règle curl-auth-user sur deploy/tests/check-observability-runtime.sh:78 : la ligne lit ${GRAFANA_ADMIN_USER:-conexa}, une variable shell à valeurs de développement, pas un secret ; ignoré au niveau de son empreinte exacte dans .gitleaksignore, vérifié avec la même version épinglée que la CI (v8.24.3) et les mêmes flags. Vérifié : pnpm verify (76 tâches --force, aucun cache), format:check, docs:verify, audit --audit-level=high, gitleaks, tests Python du worker IA (59). Limite : la CI n'a pas encore été relue après le dernier push (relire le run GitHub avant de clore)."
---

## Objectif

Que `main` reparte en vert sur toutes les étapes de `.github/workflows/ci.yml` après la fusion du
bus d'événements (T-0051), sans affaiblir aucun garde-fou.

## Contexte et règles métier

`.github/workflows/ci.yml` enchaîne, sur tout push sur `main` : `pnpm install --frozen-lockfile`,
`pnpm format:check`, `pnpm docs:verify`, `turbo lint typecheck test build`, `pnpm audit
--audit-level=high` (étape « Qualité »), les tests du worker Python, et `tools/check-pii-logs.py`
+ `tools/check-secrets.py` + `gitleaks detect --all` (étape « PII et secrets »). La règle du
dépôt (`docs/STACK.md` §8) : aucun secret dans le dépôt, `gitleaks` est l'autorité sur
l'historique.

## À livrer

1. Override `multer >= 2.5.0` dans `pnpm-workspace.yaml` (régler la faille au lieu d'assouplir l'audit).
2. `.gitleaksignore` : empreinte unique acceptée, justifiée par la ligne source et son contexte.
3. Preuves : les mêmes commandes que la CI, exécutées localement, avec leur code de sortie.

## Critères d'acceptation

- [x] `pnpm audit --audit-level=high` → 0 vulnérabilité.
- [x] `pnpm install --frozen-lockfile` → 0 (lockfile cohérent avec les manifestes).
- [x] `pnpm format:check`, `pnpm docs:verify` → 0.
- [x] `pnpm turbo run lint typecheck test build --force` → 76/76, aucun cache.
- [x] `gitleaks detect --source=. --log-opts=--all` (v8.24.3, même version que la CI) → 0 fuite.
- [x] `python3 -m unittest discover -s tests` dans `services/ai-worker` → 59 tests.
- [ ] Relecture du run GitHub après le push final (impossible sans `gh` : lire l'API Actions).

## Hors périmètre

- Aucune règle de sécurité supprimée ni aucun garde-fou assoupli (l'audit reste `--audit-level=high`).
- Aucune règle gitleaks désactivée : seul une empreinte justifiée est ignorée.
- Aucune mise à jour de dépendance au-delà de `multer`.

## Preuves attendues dans la PR

- Sortie de chaque commande ci-dessus avec son code de sortie.
- URL du run GitHub Actions vert.
