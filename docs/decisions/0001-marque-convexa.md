# ADR 0001 : Convexa est la marque, « CampusLink » disparaît des documents

- **Statut** : accepté
- **Date** : 2026-10-26
- **Décideur** : humain (session d'initialisation)
- **Portée** : produit | outillage

## Contexte

Les documents produit fournis (README produit d'origine, `API.md`, `ARCHITECTURE.md`, `STACK.md`, `ROADMAP.md`, prompts d'agents) parlent de **CampusLink** et de `api.campuslink.app`. En revanche le dépôt GitHub s'appelle **CONEXA**, les maquettes, les polices et les sources de design parlent de **Convexa** (`Convexa-sources-figma/`, `Maquette Convexa App.html`, glyphes `cxa`). Deux noms pour un même produit rendent les contrats, les noms de paquets et les textes d'interface ambigus.

## Options

1. **Garder les deux** : « Convexa » côté marque, « CampusLink » côté code et documentation. Coût : chaque nouvel agent doit apprendre la correspondance, les recherches textuelles ratent la moitié des occurrences, les noms de paquets (`@campuslink/*`) contredisent le dépôt.
2. **Renommer les documents en Convexa** et aligner les identifiants techniques. Coût : réécriture unique de documents non encore implémentés ; aucun code n'existe, donc aucune rupture.
3. **Ne rien décider** : les producteurs de contrats écrivent `@campuslink/...`, la marque affichée est Convexa ; contradiction permanente.

## Décision

Option 2. **Convexa** est le nom unique du produit, du dépôt et des paquets. Dans les documents copiés dans ce dépôt :

- `CampusLink` → `Convexa` ;
- `api.campuslink.app` → `api.convexa.app` ;
- portée des paquets `@campuslink/*` → `@conexa/*` ;
- dossier du monorepo `campuslink/` → `conexa/`.

## Conséquences

- Les noms de paquets `@conexa/gateway`, `@conexa/contracts`, … sont la référence ; `AGENTS.md` et `docs/STACK.md` sont alignés.
- **Hypothèse à confirmer par l'humain** : le domaine public. `api.convexa.app` est un choix d'attente ; le domaine réel est une tâche humaine du `docs/ROADMAP.md` (« nom de domaine et comptes d'hébergement »). Le changer ne touche qu'à `docs/product/API.md` §0 et à la configuration du gateway.
- Aucune conséquence sur le schéma de données : les noms de schémas PostgreSQL (`identity`, `football`, …) ne changent pas.

## Validation

Décision humaine déjà prise. Le nom de domaine définitif reste à valider avant toute mise en production.
