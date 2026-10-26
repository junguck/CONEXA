# ADR 0002 : deux sources produit manquent, les agents s'arrêtent au lieu d'inventer

- **Statut** : accepté (en attente des fichiers)
- **Date** : 2026-10-26
- **Décideur** : humain (session d'initialisation)
- **Portée** : produit | données

## Contexte

`AGENTS.md` et `docs/STACK.md` désignent comme sources de vérité, dans `docs/product/` : le README produit, `schema.sql`, `schema_extension.sql`, `API.md` et `ARCHITECTURE.md`. Le dossier fourni contient `API.md`, `ARCHITECTURE.md` et `schema_extension.sql`, **mais pas `schema.sql` ni le README produit**. Or `schema_extension.sql` déclare lui-même dépendre de `schema.sql` (`payment_object`, `thread_kind`, `ledger`, `chat_threads`, `public.set_updated_at`), et de nombreux prompts de fonctionnalités imposent de lire « `docs/product/schema.sql` (§2 Identité) », « (§3 Football) », « (§7 Paiements) ».

Reconstruire `schema.sql` à partir de `ARCHITECTURE.md` produirait un schéma plausible mais faux : types, fonctions Elo, politiques RLS, déclencheurs de filtre de chat et contraintes d'argent ne se devinent pas. Une erreur ici se propage dans toutes les migrations.

## Options

1. **Reconstituer `schema.sql`** par déduction documentaire. Rapide, mais invente des règles d'argent et de vie privée — exactement ce que le préambule des agents interdit.
2. **Documenter le manque et bloquer les tâches concernées** jusqu'à réception des fichiers. Coût : la vague 0 reste faisable (elle ne lit pas `schema.sql`), les vagues 1+ attendent.
3. **Coder sans les sources** en se fondant sur `API.md` seul. Coût : modèles de données divergents entre services, migrations à refaire.

## Décision

Option 2. Les fichiers sont considérés comme **manquants**, pas comme « à improviser » :

- `docs/product/schema.sql` — manquant ;
- `docs/product/README.md` (README produit, cité §4, §5, §6, §8, §12, §16) — manquant.

Toute tâche qui liste l'un de ces fichiers dans `reads` passe à `blocked` avec `notes: needs human: docs/product/schema.sql` (ou README produit). Les tâches de la vague 0 (F0.1 à F0.9) n'en dépendent pas, sauf F0.7 qui lit le README produit §16 : elle peut démarrer sur les maquettes (`docs/product/design/`) mais doit signaler le manque.

## Conséquences

- L'humain dépose les deux fichiers dans `docs/product/` ; l'ADR passe à « accepté (fichiers reçus) » et les tâches bloquées reprennent.
- Aucun agent ne crée un `schema.sql` « provisoire » : une migration fondée sur un schéma inventé est un incident de données, pas un progrès.
- `docs/STATUS.md` porte la ligne de blocage jusqu'à réception.

## Validation

Humain : fournir les fichiers. `review:architect-ok` à la réception pour vérifier la cohérence avec `schema_extension.sql` et `ARCHITECTURE.md`.
