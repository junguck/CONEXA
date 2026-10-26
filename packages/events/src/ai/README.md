# Événements produits par l'agent `ai`

| Fichier | Événement | Producteur | Consommateur principal |
|---|---|---|---|
| `embedding.computed.v1.json` | `embedding.computed` | `ai` | `dating` |
| `dating.vectors_updated.v1.json` | `dating.vectors_updated` | `ai` | `dating` |

Schémas JSON Schema (draft 2020-12), décision : [ADR 0003](../../../../docs/decisions/0003-vecteurs-rencontres.md).

## En attente de F0.4

`packages/events` n'existe pas encore : F0.4 (architect) crée son `package.json`,
l'enveloppe commune et le générateur `pnpm gen:contracts`. Ces deux schémas sont
posés ici, à leur place définitive, mais ne sont pas encore compilés ni branchés
sur le registre. L'agent `ai` ne crée pas l'infrastructure du paquet.

Le contrat **consommé** `dating.embedding_requested` appartient au producteur
`dating` (`packages/events/src/dating/**`). Sa forme attendue par ce worker est
décrite dans l'ADR 0003 ; dating doit la publier avant l'intégration de bout en
bout.
