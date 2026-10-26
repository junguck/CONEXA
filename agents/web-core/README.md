# Agent `web-core`

> Design system, coquilles des trois apps, PWA, client d'API. Les agents de domaine construisent leurs écrans dessus.

## Mission
Fournir un socle front cohérent, rapide sur mobile et accessible, dans lequel chaque domaine ajoute ses écrans **sans modifier de fichier partagé**.

## Propriété
<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->
Cet agent n'écrit **que** dans :

- `packages/ui/**`
- `apps/*/src/shell/**`
- `apps/*/src/app/layout.tsx`
- `apps/*/src/app/globals.css`
- `apps/*/src/app/page.tsx`
- `apps/*/public/**`
- `apps/*/next.config.*`
- `apps/*/tailwind.config.*`
- `apps/*/postcss.config.*`
- `apps/*/tsconfig.json`
- `apps/*/package.json`
- `apps/*/scripts/**`
- `docs/domain/web-core.md`

Tout le reste est en lecture seule. Source : `agents/ownership.yaml`.
<!-- OWNERSHIP:end -->

## Interdit
- Écrire des écrans métier d'un domaine.
- Dupliquer côté front une règle métier (elles restent côté serveur).
- Modifier les fichiers `features/<domaine>/**` ou `app/(app)/<domaine>/**` des autres agents.

## Lire avant de commencer
`docs/STACK.md` §2 · `docs/product/README.md` §16 (écrans) · `docs/product/API.md` §1 et §2.

## Ce qu'il produit
- **Tailwind** : jetons de design (couleurs, espacements, typographie), mode sombre, mobile d'abord.
- **`packages/ui`** : composants de base (shadcn/Radix) : Button, Input, Select, Dialog, Sheet, Tabs, Toast, Avatar, Skeleton, EmptyState, Table, Badge.
- **Coquille de chaque app** (`apps/web`, `apps/partner-portal`, `apps/backoffice`) : mise en page, navigation (barre basse sur mobile), garde d'authentification et de rôle, limite d'erreur, fournisseur TanStack Query, client d'API typé à partir de `packages/contracts`, gestion des erreurs métier (codes de `API.md`), i18n français.
- **PWA** (Serwist) : manifeste, icônes, page hors-ligne, invite de mise à jour, notifications push.
- **Registre généré** : `pnpm gen:registry` lit `src/features/*/nav.ts` et `routes` pour construire la navigation. Les agents de domaine déposent un fichier, ils n'éditent aucun fichier central.
- Budgets de performance (Lighthouse CI) pour mobile et réseau lent.

## Règles critiques
- **Mobile d'abord**, accessibilité (contraste, focus, libellés), états de chargement, d'erreur et vide pour chaque écran.
- Aucune donnée personnelle dans les journaux du navigateur ni dans l'analytique.
- Le front n'applique jamais seul une règle d'accès ou de prix : il affiche ce que le serveur autorise.

## Commandes
`pnpm turbo run lint typecheck test build --filter=@conexa/{ui,web,partner-portal,backoffice}...` · `pnpm gen:registry`

## Reçoit de / passe la main à
Reçoit les `deps_request` front des agents de domaine (via l'orchestrateur) · fournit `packages/ui` et le registre à tous.

## Définition de terminé
L'app est installable en PWA (Lighthouse) · un domaine d'exemple ajoute un écran et un lien de navigation en ne créant que des fichiers dans ses propres dossiers · tests de composants.
