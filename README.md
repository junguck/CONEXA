# Système d'agents Convexa

Ce dossier décrit comment une équipe d'agents construit Convexa **sans se marcher dessus**, sous la coordination d'un agent orchestrateur et la supervision d'un humain.

## Contenu

| Fichier | Rôle |
|---|---|
| `README.md` (celui-ci) | Vue d'ensemble, règles anti-collision, boucle de l'orchestrateur |
| `GIT_WORKFLOW.md` | Branches, worktrees, commits, PR, fusion, conflits, migrations |
| `ownership.yaml` | **Propriété des chemins** : source de vérité lue par la CI |
| `PROMPTS_BASE.md` | Prompt commun et prompt de base de chaque agent |
| `PROMPTS_FEATURES.md` | Un prompt par fonctionnalité de `docs/ROADMAP.md` |
| `<agent>/README.md` | Fiche de chaque agent |
| `tasks/_TEMPLATE.md` | Modèle de fichier de tâche |

## Équipe

| Agent | Responsabilité | Écrit dans (résumé) |
|---|---|---|
| [`orchestrator`](agents/orchestrator/README.md) | Planifie, assigne, fusionne, rend compte | `tasks/`, `agents/`, roadmap, statut |
| [`architect`](agents/architect/README.md) | Contrats communs, événements, ADR, gabarit de service, revue des migrations | `packages/{messaging,errors}`, `contracts|events/common`, `docs/decisions` |
| [`platform`](agents/platform/README.md) | Outillage, CI, Docker, observabilité, déploiement | `.github`, `deploy`, `tools`, racine du dépôt |
| [`gateway`](agents/gateway/README.md) | Point d'entrée, routage, limites de débit | `services/gateway` |
| [`web-core`](agents/web-core/README.md) | Design system, coquilles des apps, PWA | `packages/ui`, `apps/*/src/shell` |
| [`identity`](agents/identity/README.md) | Authentification, profils, modération | `services/identity` + ses écrans |
| [`football`](agents/football/README.md) | Équipes, matchs, Elo, classements | `services/football` + ses écrans |
| [`dating`](agents/dating/README.md) | Rencontres, dates, révélation de contact | `services/dating` + ses écrans |
| [`talents`](agents/talents/README.md) | Compétences, publications, missions, événements | `services/talents` + ses écrans |
| [`marketplace`](agents/marketplace/README.md) | Services entre étudiants, commandes | `services/marketplace` + ses écrans |
| [`partners`](agents/partners/README.md) | Partenaires, restaurant, offres, sponsoring | `services/partners` + portail |
| [`money`](agents/money/README.md) | Paiements Campay, séquestre, abonnements, droits | `services/{payments,billing}` + ses écrans |
| [`realtime`](agents/realtime/README.md) | WebSocket, notifications, chats, filtre anti-chiffres | `services/realtime` + ses écrans |
| [`ai`](agents/ai/README.md) | Embeddings, recommandations, mise à jour vectorielle | `services/ai-worker` |
| [`qa`](agents/qa/README.md) | Tests de bout en bout, de contrat, de charge | `tests/`, `packages/testing` |
| [`security`](agents/security/README.md) | Revue de sécurité (lecture seule), modèles de menace | `docs/security` |

Les agents de domaine (identity, football, dating, talents, marketplace, partners, money, realtime) sont des **tranches verticales** : chacun possède son service, ses migrations, ses contrats, ses événements **et ses écrans**. Cela évite les passages de relais entre un agent « back » et un agent « front » pour une même fonctionnalité.

---

## Neuf règles anti-collision

1. **Un chemin, un propriétaire.** `ownership.yaml` n'autorise aucun recouvrement ; `tools/check-ownership` (F0.3) fait échouer la CI si une PR touche un chemin qui n'est pas celui de son agent ou de sa tâche.
2. **Un agent exécute une seule tâche à la fois**, et **un seul agent travaille par domaine** à un instant donné.
3. **Contrat d'abord, producteur propriétaire.** Le domaine qui produit une API ou un événement possède son contrat et le publie dans une PR séparée, fusionnée avant que les consommateurs ne démarrent. Les consommateurs utilisent des types générés ; ils ne les éditent jamais.
4. **Enregistrement automatique plutôt que fichiers partagés** : routes du gateway lues dans `services/<s>/gateway.routes.json`, un fichier par événement, migrations dans `db/migrations/<schéma>/`, navigation des apps générée depuis `features/*/nav.ts` par `pnpm gen:registry`.
5. **Un worktree git par tâche** : deux agents ne partagent jamais un répertoire de travail.
6. **Le lockfile se régénère** (`pnpm install`), il ne se fusionne jamais à la main. Une dépendance à ajouter hors de ses chemins passe par `deps_request` : l'orchestrateur crée d'abord une tâche pour le propriétaire du `package.json` concerné.
7. **Demande plutôt que contournement.** Besoin d'un fichier d'un autre agent : la tâche passe à `blocked`, avec `notes: needs <agent>: <demande précise>`. L'orchestrateur crée la tâche chez le propriétaire.
8. **L'orchestrateur ne lance deux tâches en parallèle que si leurs `owned_paths` sont disjoints** et qu'aucune ne dépend d'un contrat non fusionné de l'autre.
9. **Petites PR, file de fusion, rebase.** Le dernier arrivé se rebase sur `main` ; l'agent propriétaire résout ses conflits, jamais l'orchestrateur à sa place.

---

## Cycle de vie d'une tâche

```
todo ──► in_progress ──► review ──► done
  │            │            │
  │            └──► blocked ◄┘     (needs <agent> | needs-human)
  └── (dépendances non satisfaites : reste todo)
```

| Statut | Qui le pose | Signification |
|---|---|---|
| `todo` | orchestrator | Créée, prête ou en attente de dépendances |
| `in_progress` | agent | Branche et worktree créés ; sert de verrou |
| `review` | agent | PR ouverte, CI verte, preuves jointes |
| `blocked` | agent | Arrêt volontaire : demande à un autre agent ou à l'humain |
| `done` | orchestrator | PR fusionnée, contrôles de fin passés |

Chaque agent ne modifie dans son fichier de tâche que `status`, `branch`, `worktree`, `pr` et `notes`.

---

## Boucle de l'orchestrateur

À chaque passage (manuel ou planifié) :

1. **Lire l'état** : `docs/ROADMAP.md`, `tasks/`, PR ouvertes, état de la CI, `docs/STATUS.md`.
2. **Débloquer** : traiter les tâches `blocked` (créer la tâche demandée chez le bon agent, ou escalader à l'humain avec étiquette `needs-human`).
3. **Fusionner** : pour chaque PR prête, vérifier les conditions de fusion (ci-dessous), fusionner dans l'ordre des dépendances, puis marquer `done`.
4. **Choisir les tâches prêtes** : dépendances `done`, agent libre, chemins disjoints des tâches en cours, plafond de concurrence respecté.
5. **Créer ou découper** : transformer une fonctionnalité de la roadmap en fichiers `tasks/T-xxxx-*.md` à partir du modèle ; découper les tailles L ; mettre les contrats avant les consommateurs.
6. **Lancer** les agents avec leur prompt de base (`PROMPTS_BASE.md`) et le prompt de fonctionnalité (`PROMPTS_FEATURES.md`).
7. **Rendre compte** : mettre à jour `docs/STATUS.md` (tableau court : en cours, bloqué, fusionné, prochaines étapes, décisions attendues de l'humain).

### Conditions de fusion d'une PR
- CI verte (lint, types, tests, build, intégration, propriété, contrats, migrations, secrets).
- Étiquettes de revue présentes selon `review_rules` : `review:architect-ok`, `review:security-ok`, `human-ok`.
- Preuves jointes et critères d'acceptation cochés.
- Aucun chemin hors propriété ; aucune migration déjà fusionnée modifiée.

### Ce que l'orchestrateur ne fait jamais
Écrire du code produit · modifier les chemins d'un autre agent · contourner une revue ou la CI · accéder à la production ou aux secrets · résoudre une ambiguïté de règle produit à la place de l'humain.

---

## Escalade vers l'humain (`needs-human`)
Règle produit ambiguë ou contradictoire entre documents · validation obligatoire (voir roadmap) · deux échecs de CI sur la même cause · besoin d'un secret, d'un compte ou d'une décision juridique · coût ou concurrence au-dessus du plafond · tout ce qui touche l'argent ou des données personnelles de façon inattendue. L'agent décrit le problème, propose une option recommandée, puis s'arrête.
