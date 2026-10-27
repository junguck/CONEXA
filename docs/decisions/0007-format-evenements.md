# ADR 0007 : Format des événements, outbox et reprise

- **Statut** : proposé
- **Date** : 2026-10-26 ; renuméroté `0007` le 2026-10-27
- **Décideur** : agent `architect` (tâches T-0004 et T-0051)
- **Portée** : contrats | outillage

> Numérotation : `0003`, `0004` et `0005` sont pris par la piste v1
> (`0003-schema-base-reconstitue`, `0004-nestjs-esm-vitest`, `0005-kit-de-service-partage`) et `0006`
> par les vecteurs de rencontre (`0006-vecteurs-rencontres`, fusionné avec T-0018). Cet ADR, livré
> d'abord sous le numéro `0006`, prend donc le numéro libre suivant, `0007`, à sa fusion dans `main`.

## Contexte

`docs/product/ARCHITECTURE.md` §5.2 fixe un catalogue d'événements (un producteur, plusieurs
consommateurs) et exige des « JSON Schema versionnés » dans `packages/events`. `docs/STACK.md` §2
retient Zod comme source des schémas, les JSON Schema étant générés. `docs/STACK.md` §1 impose
RabbitMQ entre services.

La tâche T-0004 doit livrer le langage commun : enveloppe d'événement, outbox/inbox, politique de
reprise, topologie du bus, catalogue des codes d'erreur, sans écrire de logique de domaine.

Contraintes issues des documents produit :

- un événement a **un seul producteur** ; les consommateurs ne l'écrivent jamais ;
- **aucune PII** dans un événement : identifiants seulement ;
- livraison **au moins une fois** ⇒ consommateurs idempotents ;
- **l'ordre n'est pas garanti** ;
- une rupture de schéma ne modifie pas un événement existant : elle crée une nouvelle version.

## Options

1. **Payload à plat, sans enveloppe.** Le plus simple à produire, mais impossible de distinguer
   les métadonnées des champs métier, pas de trace, pas de version : chaque service réinvente son
   format et le garde-fou PII devient inapplicable.
2. **CloudEvents 1.0.** Standard, interopérable. Coût : champs (`source`, `specversion`, `subject`)
   partiellement redondants avec le catalogue produit, et une dépendance conceptuelle à une spec
   externe pour un bus interne qui n'échange que nos types.
3. **Enveloppe minimale maison (retenue).** `id`, `type`, `version`, `occurred_at`, `producer`,
   `traceparent?`, `payload`. Sept champs, alignés sur le catalogue produit, versionnés par un
   JSON Schema généré depuis Zod.

## Décision

**Option 3.** L'enveloppe vit dans `@conexa/events` (`src/common/envelope.ts`).

- **`type`** : `domaine.action` en minuscules (`user.approved`, `payment.escrowed`,
  `service_order.requested`). Il ne contient **pas** de numéro de version.
- **`version`** : version du schéma de `payload` pour ce `type`. Une rupture produit `v2` (nouveau
  fichier `<type>.v<n>.json`, `version: 2`), jamais une modification sur place. Les changements
  compatibles (champ optionnel ajouté) restent dans la même version.
- **`producer`** : nom du service producteur, unique pour un `type` donné ; il est déclaré dans
  `docs/domain/<service>.md` du producteur.
- **`traceparent`** : en-tête W3C optionnel, propagé dans les en-têtes AMQP
  (`amqpHeaders` / `traceparentFromHeaders`).
- **PII** : `assertNoPii` refuse les clés de contact et de secret (`whatsapp`, `phone`, `email`,
  `matricule`, `password`, `token`, `payment_url`…), y compris imbriquées dans des tableaux.
  Exception assumée : les champs publics que `user.updated` doit transporter pour alimenter
  `user_cards` (`first_name`, `photo_url`) restent autorisés — c'est le choix de
  `docs/product/ARCHITECTURE.md` §4, pas une fuite.
- **Publication** : table `outbox` écrite dans la transaction métier, publication après commit par
  `OutboxDispatcher` ; reprise à délai croissant (1 s × 2, plafond 60 s, jitter ±20 %) ; après
  10 tentatives, le message va en **file des échecs** (`<service>.failed`), jamais supprimé.
- **Consommation** : table `inbox` avec clé `(consumer, message_id)` ; `consumeIdempotent` ignore
  un doublon et n'inscrit le message qu'après un traitement réussi.
- **OpenAPI** : OpenAPI 3.1 accepte JSON Schema 2020-12, donc `z.toJSONSchema` suffit ; on n'ajoute
  pas `zod-to-openapi`. Le document des composants communs est généré par
  `pnpm --filter @conexa/contracts gen:contracts` et committé (`packages/contracts/openapi/common.json`).
- **Catalogue d'erreurs** : `@conexa/errors` reprend tous les codes de `docs/product/API.md` §1 et
  ajoute `INTERNAL_ERROR` (500), seul code absent du document produit, pour les échecs imprévus
  normalisés par le Gateway.

## Conséquences

- Les services importent `@conexa/{contracts,events,messaging,errors}` ; aucun ne redéfinit un
  montant, une pagination ou une enveloppe.
- **T-0005** doit adopter `packages/messaging/sql/outbox-inbox.sql` (tables dans le schéma du
  service), `serviceTopology` pour déclarer ses files, `consumeIdempotent` pour ses consommateurs.
- **T-0003** peut comparer les JSON Schema committés (`packages/events/src/common/schemas/*.json`,
  `packages/contracts/openapi/common.json`) : le test de dérive échoue si un schéma change sans
  régénération.
- Un alias racine `pnpm gen:contracts` reste à créer par `platform` (le `package.json` racine est
  hors du périmètre de l'agent `architect`) ; en attendant,
  `pnpm --filter @conexa/contracts gen:contracts` — voir la note de la PR.
- Les tests d'intégration sur **vrai RabbitMQ et PostgreSQL** (publication transactionnelle,
  doublon ignoré, reprise après panne, file des échecs) restent à exécuter sur un poste disposant
  de Docker : le poste de cette session ne l'a pas (`HypervisorPresent=false`, déjà signalé en
  T-0002 et T-0006).

## Validation

- `review:architect-ok` (contrats et événements) et `review:security-ok` (garde-fou PII).
- Reste à vérifier avant production : exécution des tests d'intégration bus + base sur un
  environnement Docker, et confirmation humaine de l'alias racine `gen:contracts`.
