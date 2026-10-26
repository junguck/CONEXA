# ADR 0005 : un kit partagé `@conexa/service-kit` en attendant le générateur F0.5

- **Statut** : accepté provisoirement
- **Date** : 2026-10-26
- **Décideur** : agent `architect`
- **Portée** : outillage

## Contexte

`docs/STACK.md` §4 décrit `services/_template` comme gabarit **copié** par `pnpm new:service` (tâche F0.5, non faite). Pour livrer six services dans la même passe, copier six fois la configuration, la connexion Kysely, le garde JWT, le filtre d'erreurs et la santé multiplierait les divergences — et chaque correction devrait être répétée six fois.

## Options

1. **Copier le gabarit six fois** : conforme à la cible, mais six copies de ~150 lignes à maintenir, et les corrections futures passent par six PR.
2. **Kit partagé** `@conexa/service-kit` : une seule implémentation, importée par chaque service ; le gabarit `services/_template` reste comme exemple et comme point de départ du générateur.
3. **Attendre F0.5** : aucun service livré dans cette passe.

## Décision

Option 2. `@conexa/service-kit` contient : validation d'environnement (Zod), connexion Kysely bornée au schéma du service, vérification JWT RS256 (clé publique ou JWKS), garde et décorateurs, filtre d'erreurs au format `API.md`, `request-id`, logs pino avec masquage, modules `/health` et `/ready`, amorçage Nest.

`services/_template` montre l'assemblage attendu (config, base, module, contrôleur protégé, manifeste de routes).

## Conséquences

- Un service fait ~10 fichiers au lieu de ~25 ; les règles transverses se corrigent en un endroit.
- `packages/service-kit/**` appartient à l'agent `architect` (`agents/ownership.yaml` modifié) et exige `review:architect-ok`.
- Quand F0.5 arrive, le générateur peut soit copier le gabarit, soit continuer à dépendre du kit ; la décision sera alors revue.
- Le service peut être déployé seul : le kit est un paquet de compilation, pas un runtime partagé.

## Validation

`review:architect-ok` sur la modification d'`ownership.yaml` (chemin humain).
