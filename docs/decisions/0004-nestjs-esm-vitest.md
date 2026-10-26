# ADR 0004 : services en ESM, Vitest pour tous les tests

- **Statut** : accepté
- **Date** : 2026-10-26
- **Décideur** : agent `architect` (contrainte technique vérifiée), à confirmer par l'humain
- **Portée** : outillage

## Contexte

`docs/STACK.md` §2 propose **Jest pour NestJS** et **Vitest pour les paquets et le front**. En installant la pile (Node 22, `@nestjs/*` 12.2.0), deux contraintes apparaissent :

1. **NestJS 12 est publié en ESM** : `@nestjs/common/index.js` contient `import`/`export`. Un service compilé en CommonJS échoue au chargement (`ERR_REQUIRE_ESM`) ; Jest 30 sur Node 22 refuse de charger ces modules (le support `require(esm)` de Jest demande Node ≥ 24.9).
2. **`ts-jest` et les décorateurs Nest** exigent des imports de valeur que la règle `consistent-type-imports` interdit : conflit connu avec `emitDecoratorMetadata`.

## Options

1. **Rester en CommonJS et rétrograder NestJS en 11** : Jest et `ts-jest` fonctionnent, mais on épingle une version majeure précédente et on repousse la migration ESM.
2. **Passer en ESM** : services compilés par `tsc` en `NodeNext`, exécutés par `node dist/main.js`, tests en **Vitest** (natif ESM, déjà utilisé par les paquets).
3. **ESM partout mais Jest avec `--experimental-vm-modules`** : configuration instable, deux configurations de test dans le dépôt.

## Décision

Option 2.

- Tous les paquets et services sont `"type": "module"`, compilés en `NodeNext` ; imports relatifs avec extension `.js`.
- **Vitest** remplace Jest, y compris pour les services NestJS : les tests démarrent le module Nest avec `NestFactory` et interrogent l'API avec `supertest`.
- Le preset `@conexa/config/tsconfig/nest.json` porte les décorateurs et `emitDecoratorMetadata` ; la règle `consistent-type-imports` est désactivée (les paquets ESM restent protégés par `verbatimModuleSyntax`).

## Conséquences

- STACK.md §2 (« Jest pour NestJS ») devient obsolète sur ce point : `docs/STACK.md` est la propriété de l'architecte et sera mis à jour à la fusion de cette branche.
- Exécution : `node dist/main.js` après `pnpm build`. Pas de CLI Nest nécessaire.
- Un futur retour à Jest demanderait Node ≥ 24.9 et une configuration ESM dédiée.
- Les tests HTTP ne nécessitent pas de base : les règles métier pures sont testées séparément, et les requêtes SQL restent vérifiées par les migrations appliquées sur PostgreSQL.

## Validation

`review:architect-ok` + `human-ok` (mise à jour de STACK.md §2).
