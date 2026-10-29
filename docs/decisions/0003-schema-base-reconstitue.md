# ADR 0003 : schéma de base — source retrouvée et migrations v1 reconstituées

- **Statut** : **accepté** (source clarifiée par l'humain le 2026-10-29), alignement
  des trois schémas concernés **à faire**
- **Date** : 2026-10-26, mis à jour le 2026-10-29
- **Décideur** : humain
- **Portée** : données

## Contexte

`docs/product/schema.sql` n'a jamais été fourni (ADR 0002) alors que le produit en
dépendait et que `schema_extension.sql` le complétait. En l'absence du fichier, les
migrations des six premiers services ont été **reconstituées** depuis `API.md`,
`ARCHITECTURE.md` et `schema_extension.sql` (décision du 2026-10-26, option 2).

**Clarification du 2026-10-29** : le fichier d'origine que détient l'humain
**est **`docs/product/schema_extension.sql`. Il n'y a pas de `schema.sql` distinct à
attendre. La source de vérité est donc le fichier présent dans le dépôt, et les
écarts se corrigent désormais en le comparant.

## Ce que couvre réellement `schema_extension.sql`

Le fichier crée les extensions `pgcrypto`, `citext` et `vector`, puis définit
**trois schémas et eux seuls** :

| Schéma | Tables définies par la source |
|---|---|
| `billing` | `plans`, `free_entitlements`, `subscriptions`, `promo_codes`, `invoices`, `entitlement_grants`, `outbox`, `inbox` |
| `marketplace` | `user_cards`, `categories`, `prohibited_terms`, `service_listings`, `service_packages`, `availability_slots`, `service_orders`, `order_deliveries`, `order_events`, `service_reviews`, `disputes`, `favorites`, `outbox`, `inbox` |
| `partners` | `organizations`, `staff`, `agreements`, `venues`, `offers`, `vouchers`, `sponsorship_packages`, `sponsorship_deals`, `sponsorship_assets`, `ad_placements`, `ad_stats_daily`, `outbox`, `inbox` |

Les schémas `identity`, `football`, `dating`, `talents`, `payments`, `messaging`,
`notifications`, `uploads` et `ai` **ne figurent pas** dans la source : pour eux,
les migrations reconstituées restent la seule définition existante.

## Comparaison faite le 2026-10-29 (table par table)

### `billing`

| Table de la source | Migration v1 | Écart |
|---|---|---|
| `plans` | `plans` | présente |
| `subscriptions` | `subscriptions` | présente |
| `invoices` | `invoices` | présente |
| `promo_codes` | `promo_codes` | présente |
| `free_entitlements` | — | **manquante** : les droits gratuits sont codés en valeurs par défaut, pas en table |
| `entitlement_grants` | — | **manquante** : aucun historique des droits accordés |
| `outbox` / `inbox` | — | **manquantes côté billing** (le paquet `@conexa/messaging` fournit le DDL, non appliqué ici) |

### `marketplace`

| Table de la source | Migration v1 | Écart |
|---|---|---|
| `service_listings` | `service_listings` | présente |
| `categories` | `service_categories` | **renommée** |
| `service_packages` | `listing_packages` | **renommée** |
| `availability_slots` | `listing_availability` | **renommée** |
| `service_orders` | `service_orders` | présente |
| `order_events` | `service_order_events` | **renommée** |
| `service_reviews` | `order_reviews` | **renommée** |
| `disputes` | `order_disputes` | **renommée** |
| `favorites` | `listing_favorites` | **renommée** |
| `user_cards` | — | **manquante** |
| `prohibited_terms` | — | **manquante** (le filtre de termes est en code) |
| `order_deliveries` | — | **manquante** (livraison fusionnée dans la commande) |
| — | `listing_boosts` | **ajoutée** par la v1, absente de la source |

### `partners`

| Table de la source | Migration v1 | Écart |
|---|---|---|
| `organizations` | `organisations` | **orthographe différente** : la v1 a francisé le nom |
| `venues` | `venues` | présente |
| `offers` | `offers` | présente |
| `staff` | — | **manquante** : l'accès au portail partenaire n'est pas modélisé |
| `agreements` | — | **manquante** : aucun contrat partenaire en base |
| `vouchers` | `offer_redemptions` | **renommée** et réduite (pas de bon à usage unique) |
| `sponsorship_packages`, `sponsorship_deals`, `sponsorship_assets`, `ad_placements`, `ad_stats_daily` | — | **manquantes** : le sponsoring et les bannières ne sont pas modélisés |
| — | `formulas`, `menu_items`, `slots` | **ajoutées** par la v1 (formules de date, menu, créneaux) |

## Décision

1. **La source de vérité est `docs/product/schema_extension.sql`.** Aucun fichier
   `schema.sql` n'est attendu.
2. **Les migrations déjà fusionnées ne sont jamais réécrites.** L'alignement se fait
   par de **nouvelles migrations**, service par service.
3. **Ordre d'alignement** : `billing` d'abord (l'argent et les droits en dépendent),
   puis `partners` (sponsoring et portail partenaire), puis `marketplace`
   (renommages, sans urgence tant que rien n'est en production).
4. **Les neuf schémas absents de la source restent reconstitués** et marqués comme
   tels : ils ne peuvent pas être « vérifiés » contre un document qui ne les
   contient pas.
5. **Les renommages gardent les noms de la source** lors de l'alignement
   (`organizations`, `categories`, `service_packages`, `availability_slots`,
   `order_events`, `service_reviews`, `disputes`, `favorites`) ; les tables ajoutées
   par la v1 (`listing_boosts`, `formulas`, `menu_items`, `slots`) deviennent des
   compléments explicites.

## Conséquences

- La question n°1 de `docs/STATUS.md` (schema.sql manquant) est **close** : le
  fichier existe, il s'appelle `schema_extension.sql`.
- Le risque restant n'est plus l'absence de source, mais la **divergence de noms** :
  un agent qui lit `API.md` et un agent qui lit les migrations peuvent nommer deux
  fois la même table. La comparaison ci-dessus est la référence tant que
  l'alignement n'est pas fait.
- Les tâches d'alignement devront être réclamées comme des tâches neuves (une par
  schéma), avec une preuve : diff vide entre les tables de la source et celles des
  migrations.

## Validation

`review:architect-ok` sur chaque migration d'alignement ; `human-ok` sur l'ordre
d'alignement ci-dessus. La comparaison table par table du 2026-10-29 est la pièce
justificative de cette mise à jour.
