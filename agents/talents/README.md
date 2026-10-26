# Agent `talents`

> Compétences, publications (besoins, projets), candidatures, missions, événements et billets, rencontres « meeter ».

## Mission
Faire se rencontrer besoins et compétences sur le campus, et permettre d'organiser des événements, avec une messagerie libre et des paiements sécurisés.

## Propriété
<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->
Cet agent n'écrit **que** dans :

- `services/talents/**`
- `db/migrations/talents/**`
- `packages/contracts/src/talents/**`
- `packages/events/src/talents/**`
- `apps/web/src/app/(app)/community/**`
- `apps/web/src/features/talents/**`
- `apps/backoffice/src/app/(admin)/talents/**`
- `apps/backoffice/src/features/talents/**`
- `docs/domain/talents.md`

Tout le reste est en lecture seule. Source : `agents/ownership.yaml`.
<!-- OWNERSHIP:end -->

## Interdit
- Mettre en œuvre le catalogue de services à la commande (domaine `marketplace`).
- Gérer l'argent directement : il demande un paiement à `payments`.
- Écrire dans les chemins d'un autre domaine.

## Lire avant de commencer
`docs/product/README.md` §7 · `docs/product/schema.sql` (§8 Projets) · `docs/product/API.md` §3.10 à §3.12, §3.18 · `docs/domain/talents.md`.

## Règles métier critiques
- Types de publications : besoin, projet, compétition, offre de service, demande d'aide.
- **Missions** : le client choisit un prestataire parmi les candidats ; paiement en **séquestre**, libéré à l'approbation moins la commission (8 % par défaut) ; litiges arbitrés par un admin ; avis réservés aux missions terminées.
- **Événements** : quota mensuel gratuit (2) et commission de billets (8 %) lus dans les **droits** fournis par Billing, jamais codés en dur ; statistiques et export réservés au plan Pro.
- Messagerie **libre** (pas de filtre de chiffres) avec signalement ; « meeter » = proposer lieu et heure.
- Recommandations par similarité cosinus (embeddings calculés par `ai`).

## Événements
Produit : `post.created`, `mission.*`, `event.created`, `event.ticket_requested`, `talents.embedding_requested`. Consomme : `payment.*`, `entitlements.changed`, `embedding.computed`, `user.*`.

## Écrans
Fil des besoins, publier, profil de compétences, recommandations, candidatures, missions, événements, billets, meetups ; back-office : modération des publications.

## Commandes
`pnpm turbo run lint typecheck test --filter=@conexa/talents...` · `pnpm test:integration --filter=@conexa/talents`

## Reçoit de / passe la main à
`money` (droits, paiements) · `ai` (embeddings) · `realtime` (fils de discussion).

## Définition de terminé
Tests des quotas du plan gratuit et Pro · aucune commission codée en dur · séquestre testé de bout en bout contre `FakeProvider`.
