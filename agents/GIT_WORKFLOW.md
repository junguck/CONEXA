# Gestion du dépôt par les agents

Objectif : un `main` toujours vert, un historique lisible, aucune collision entre agents.

## 1. Modèle de branches
- **Trunk-based** : `main` est protégée (PR obligatoire, CI verte, file de fusion, fusion par *squash*).
- Une branche courte par tâche : `agent/<agent>/<T-id>-<slug>` (exemple : `agent/football/T-0042-elo-engine`).
- Durée de vie visée : moins de deux jours. Une branche plus ancienne se rebase ou se découpe.

## 2. Un worktree par tâche
```bash
git fetch origin
git worktree add ../worktrees/T-0042 -b agent/football/T-0042-elo-engine origin/main
cd ../worktrees/T-0042
pnpm install --frozen-lockfile
```
- Le répertoire principal reste propre sur `main` (réservé à l'orchestrateur et à l'humain).
- Fin de tâche : `git worktree remove ../worktrees/T-0042` après fusion.

## 3. Commits
- **Conventional Commits**, portée = domaine : `feat(football): compute elo after validated match`.
- Types : `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `perf`, `build`, `ci`.
- Pied de message obligatoire : `Task: T-0042`.
- Petits commits qui compilent ; pas de commit « WIP » dans la PR finale (le *squash* produit un message propre : titre = titre de la PR).
- Aucun fichier généré inutile, aucun secret, aucun changement de formatage hors de ses chemins.

## 4. Ordre de travail dans une tâche
1. Lire la tâche, `reads`, `docs/domain/<domaine>.md`, les ADR concernés.
2. **Contrat** (si la tâche en crée un) : PR séparée, étiquette `review:architect-ok`, fusionnée avant le reste.
3. **Migration** (nouveau fichier horodaté) puis `pnpm db:codegen`.
4. **Tests** qui échouent.
5. **Code** jusqu'au vert.
6. Documentation du domaine, régénération OpenAPI et registres.
7. `pnpm turbo run lint typecheck test build --filter=...[origin/main]` et, si SQL ou bus, `pnpm test:integration`.
8. Rebase sur `origin/main`, vérification de propriété (`pnpm tools:check-ownership`), ouverture de la PR.

## 5. Pull request
- Titre : `[T-0042] Elo après match validé`.
- Description selon le modèle `.github/pull_request_template.md` (créé par F0.3) :
  - lien vers la tâche et critères d'acceptation cochés ;
  - **preuves** : sortie des tests, captures Playwright, exemples de requêtes ;
  - contrats touchés, migrations, événements ajoutés ;
  - dépendances ajoutées et justification ;
  - risques, retour arrière, drapeaux de fonctionnalité ;
  - idées hors périmètre (jamais implémentées dans la PR).
- Taille visée : relisable en moins de 20 minutes ; sinon découper.
- Étiquettes : `agent:<nom>`, `feature:F2.5`, plus `needs-human` si validation humaine requise.

## 6. Revues et fusion
| Condition | Étiquette |
|---|---|
| Contrats, événements, migrations, gabarit | `review:architect-ok` |
| Chemins sensibles (`review_rules.security_required`) | `review:security-ok` |
| Validation humaine obligatoire (`review_rules.human_required`) | `human-ok` |
| Parcours critiques avec tests de bout en bout | `review:qa-ok` |

La fusion est faite par l'orchestrateur (ou la file de fusion) quand la CI est verte et les étiquettes présentes. **Un agent ne fusionne jamais sa propre PR.**

## 7. Conflits
- `git pull --rebase origin main` avant l'ouverture de la PR, puis chaque fois que `main` avance.
- **Le dernier arrivé se rebase.** Les conflits dans ses propres chemins sont résolus par l'agent propriétaire.
- `pnpm-lock.yaml` : en cas de conflit, `git checkout origin/main -- pnpm-lock.yaml && pnpm install` ; jamais de fusion manuelle.
- Un conflit dans un chemin qui n'est pas le sien est le signe d'une violation de propriété : l'agent s'arrête (`blocked`) et prévient l'orchestrateur.
- Pousser avec `--force-with-lease` uniquement sur sa propre branche.

## 8. Migrations de base de données
- Dossier `db/migrations/<schéma>/`, fichiers `YYYYMMDDHHMM_description.sql`, **sens avant uniquement**.
- Une migration fusionnée **n'est jamais modifiée** (la CI refuse). Correction = nouvelle migration.
- Changements risqués en **deux temps** (expand puis contract) sur deux PR : ajouter, basculer le code, retirer plus tard.
- Toute migration destructrice (`DROP`, `TRUNCATE`, changement de type avec perte) exige `human-ok`.
- Un service ne lit ni n'écrit jamais le schéma d'un autre service.

## 9. Contrats et événements
- Un contrat existant n'est modifié que de façon **compatible** (ajout de champs optionnels). Un changement cassant crée une nouvelle version (`…v2`) ; l'ancienne reste jusqu'à ce que tous les consommateurs aient migré.
- Un fichier par événement : `packages/events/src/<domaine>/<nom>.v1.ts`.
- La CI exécute `oasdiff` et le contrôle de compatibilité des schémas ; un échec bloque la PR.

## 10. Dépendances
- Ajout seulement dans le `package.json` de ses propres paquets. Justification dans la PR (rôle, taille, maintenance, licence).
- Hors de ses chemins : `deps_request` dans la tâche ; l'orchestrateur planifie d'abord une tâche chez le propriétaire.
- Mises à jour majeures : `human-ok`.

## 11. Releases
- `main` déploie automatiquement en préproduction ; la production est promue **manuellement par l'humain**.
- Étiquettes de version par déploiement (`core-v0.3.0`, `money-v0.2.1`), jamais posées par un agent.
- Retour arrière : redéployer l'image précédente ; les migrations étant en avant seulement, une correction passe par une nouvelle migration.

## 12. Hygiène
- Pas de branche orpheline : l'orchestrateur supprime les branches des PR fusionnées ou abandonnées depuis plus de sept jours.
- Pas de commit direct sur `main`, pas de `git reset --hard` sur une branche partagée, pas de réécriture de l'historique de `main`.
- Aucun fichier de configuration personnelle ou d'éditeur dans le dépôt.
