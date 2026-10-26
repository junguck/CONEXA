# Domaine : web-core

Socle front partagé : jetons de design, composants, coquille PWA, navigation générée. Propriétaire : agent `web-core` (voir `agents/ownership.yaml`).

## Où vit quoi

| Élément | Chemin | Rôle |
|---|---|---|
| Jetons et preset Tailwind | `packages/ui/src/styles.css`, `packages/ui/tailwind-preset.cjs` | Variables CSS des univers (`s-core`, `s-foot`, `s-meet`, `s-pro`) et des thèmes (`dk`, `lt`), exposées à Tailwind |
| Composants | `packages/ui/src/*.tsx` | Button, Input, Select, Dialog, Sheet, Tabs, Toast, Avatar, Badge, Skeleton, EmptyState, Table, Card |
| Coquille | `apps/web/src/shell/` | Thème, barre basse, gardes de session, client d'API, i18n, PWA |
| Écrans globaux | `apps/web/src/app/` | Accueil Core, démonstration du design system, écran hors-ligne |
| Registre de navigation | `apps/web/src/shell/nav.generated.ts` | **Généré** depuis `apps/web/src/features/*/nav.ts` |

## Commandes

```bash
pnpm --filter @conexa/web dev            # http://localhost:3000
pnpm --filter @conexa/web gen:registry   # régénère la navigation depuis features/*/nav.ts
pnpm --filter @conexa/web build          # build Next + service worker Serwist
pnpm turbo run lint typecheck test build --filter=@conexa/ui --filter=@conexa/web
```

Le script racine `pnpm gen:registry` demandé par `AGENTS.md` n'existe pas encore : `package.json` racine appartient à `platform`. La commande équivalente vit dans `apps/web` ; un alias racine demande une tâche `platform` (voir `deps_request` de T-0007).

## Ajouter un écran de domaine

1. Créer `apps/web/src/features/<domaine>/nav.ts` (objet `{ label, href, universe, order }`, export par défaut).
2. Créer l'écran dans le même dossier, puis la route `apps/web/src/app/(app)/<section>/page.tsx` qui le rend.
3. Lancer `pnpm --filter @conexa/web gen:registry`.

Aucun fichier partagé n'est modifié à la main : l'accueil liste la nouvelle entrée et la barre basse reste inchangée. Les routes inconnues des quatre univers affichent un écran d'attente (`(app)/[...universe]`), qui s'efface dès qu'une route statique existe.

## Règles de design appliquées

- Un univers par section d'URL (`football`, `meet`, `pro`, sinon Core), thème par défaut de la maquette, choix de thème mémorisé dans `localStorage`.
- Cibles tactiles de 44 px minimum, contraste AA, aucun état porté par la seule couleur.
- `prefers-reduced-motion` et le réglage « Réduire les animations » coupent toutes les animations.
- Prix, Elo, révélation de contact et règles d'accès restent côté serveur ; l'interface affiche seulement.

## PWA

- Manifeste généré par `apps/web/src/app/manifest.ts` (icônes 192/512 et maskable dans `public/icons/`).
- Service worker Serwist (`apps/web/src/app/sw.ts`) : précache, repli hors-ligne sur `/offline`, mise à jour proposée par `shell/pwa/update-prompt.tsx` (jamais imposée).
- Notifications : `shell/pwa/push.ts` (VAPID, clé publique `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, abonnement sur geste explicite). L'envoi appartient au service Realtime.

## Vérifications (T-0007, 2026-10-26)

```
pnpm turbo run lint typecheck test build --filter=@conexa/ui --filter=@conexa/web
  Tasks: 11 successful, 11 total

@conexa/ui  8 tests (Button, Input, EmptyState, Avatar, Badge, Table, Skeleton)
@conexa/web 21 tests (gardes de session, catalogue d'erreurs, client d'API, registre de navigation)

Lighthouse 12 (Chrome headless, build de production, http://localhost:3108) :
  performance 94 · accessibilité 100 · bonnes pratiques 100
  PWA : aucun audit en échec (manifeste installable, service worker, hors-ligne)

Service worker (navigateur, build de production) :
  scope http://localhost:3108/ · state activated · controller true
  cache serwist-precache-v2-http://localhost:3108/

Routes générées : /, /demo, /design, /offline, /manifest.webmanifest, /[...universe]
```

## Limites connues

- **Contrats d'API** : le client (`shell/api/client.ts`) est typé localement ; il branchera `@conexa/contracts` après fusion de T-0004.
- **Authentification** : les gardes (`shell/auth/guards.ts`) sont testées mais aucune session n'est fournie tant que F1.1 n'existe pas ; l'app est publique en attendant.
- **Police** : les WOFF2 de la maquette sont copiés dans `apps/web/public/fonts/` (676 Ko, latin uniquement).
- **Lighthouse** : l'audit d'installation reste à joindre à la PR (voir T-0007).
