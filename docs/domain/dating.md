# Domaine Rencontres (dating)

Service `@conexa/dating`, schéma PostgreSQL `dating`.
Source produit : `docs/product/API.md` §3.7 à §3.9, `ARCHITECTURE.md` §2, §5 et §6.1.
Tâches : `tasks/T-0014-dating-v1.md`, `T-0035`, `T-0057`, `T-0058`.

## Décisions appliquées au 12/11/2026

| Sujet | Décision | Où |
|---|---|---|
| Créneaux du date | Un créneau est un **créneau Partners**. Dating ne duplique plus les créneaux du restaurant : `dates.slot_id` porte l'identifiant opaque Partners et `dates.slot_starts_at` l'heure de début recopiée à la retenue | migration `202611120900_slots_partners_no_credits.sql` |
| Révélation du contact | **Décision 15B** : uniquement après le **check-in des deux participants**. La règle « deux oui » est supprimée du domaine et des tests | `canRevealContact`, `DatesService.contact` |
| Crédit restaurant | **Décision 16C** : supprimé. Table `date_credits`, route `GET /me/credits` et tout solde restaurant ont disparu | migration `202611120900…` |
| Paiement | La saga de réservation est branchée sur `pay` / `cancel` / `setSlot` | `DatesService`, `ReservationSagaService` |

## Périmètre livré

- Éligibilité : 18 ans révolus, questionnaire rempli, fiabilité ≥ 60 (mineur refusé partout).
- Questionnaire fermé (12 questions, valeurs et notes 1–5), aucun texte libre.
- Profil, préférences, pause et reprise.
- Trois propositions par semaine (deux « ressemblantes », une « complémentaire »),
  classées par **similarité cosinus pondérée** des vecteurs IA, avec quarantaine de
  60 jours après un refus et filtration des profils déjà proposés.
- Invitations : trois par semaine maximum, jamais augmentées par un abonnement ;
  un refus n'est jamais montré à l'émetteur.
- Date : cartes fermées, créneau Partners retenu par la saga, formule choisie par le
  payeur, commandes plafonnées, paiement par saga, annulation à 3 h, check-in par code,
  SOS, retour privé, révélation du contact.
- Outbox transactionnelle pour `dating.embedding_requested`, consommation idempotente
  de `embedding.computed` dans `profile_vectors`.

## Règles produit et implémentation

| Règle | Implémentation |
|---|---|
| 18 ans révolus | `assertAdult`, refus `AGE_RESTRICTED` (prioritaire sur toute autre raison) |
| 3 propositions / semaine | `PICKS_PER_WEEK`, semaine ISO (lundi UTC) |
| 3 invitations / semaine | `assertInviteQuota` → `WEEKLY_QUOTA_EXCEEDED` |
| L'invitant paie | `resolvePayer()` : refuse identifiant manquant, blanc ou participants identiques |
| Annulation gratuite jusqu'à 3 h | `canCancelDate(date.slot_starts_at, now)` → `CANCEL_WINDOW_CLOSED` |
| Cartes seulement | `payloadFor()` : charge utile fermée, aucun texte libre |
| **Contact après check-in des deux** | `canRevealContact({ status, checkedInAAt, checkedInBAt })` ; un seul check-in, un `no_show` ou une annulation ne révèlent rien |
| Pas de crédit restaurant | aucune table, aucune route, aucun écran de solde |
| Machine d'états | `negotiating → awaiting_payment → confirmed → checked_in → completed`, sorties `cancelled`, `no_show`, `disputed` |

Le retour (`date_feedback`) reste **privé** : il alimente la qualité des propositions et
n'ouvre plus la révélation. `wants_contact` y est conservé comme signal produit, sans
effet sur l'accès au numéro.

## Réservation : saga et frontières de service

`ReservationSagaService` (machine pure dans `reservation.machine.ts`, actions
persistées dans `reservation_sagas` / `reservation_actions`) orchestre :

```
holding ─hold_ok→ awaiting_payment ─payment_escrowed→ confirming ─hold_confirmed→ confirmed
   │                    │                                  │
hold_rejected      payment_failed / hold_expired       confirm_failed
   ▼                    ▼                                  ▼
failed(SLOT_LOST)   failed(PAYMENT_FAILED|HOLD_EXPIRED)  failed(HOLD_EXPIRED) + remboursement
```

- `setSlot` et `pay` **démarrent** la saga (`start` est idempotent : rejouer ne crée pas
  une seconde tentative).
- `pay` ne confirme **rien** : il retient la table et attend `payment.escrowed`.
  C'est la saga qui confirme la table puis le date (`confirm_date`).
- `cancel` envoie `cancel_requested` : la retenue est libérée, un séquestre éventuel est
  remboursé une seule fois.
- Chaque appel sortant est idempotent chez le destinataire ; un crash entre deux appels
  laisse l'action due et le planificateur la reprend (`DatingScheduler` → `saga.runDue`).
- Dating n'écrit jamais dans le schéma `partners` ni `payments` : uniquement
  `/internal/partners/*` et `/internal/payments/*` par jeton de service
  (`PARTNERS_URL`, `PAYMENTS_URL`, `SERVICE_TOKEN`).

### Contrat attendu de Partners (dépendance ouverte)

`POST /internal/partners/slots/:id/hold` doit renvoyer, en plus de `expires_at`,
**`starts_at`** : sans lui, la fenêtre d'annulation de 3 h ne peut pas être calculée.
Dating refuse alors la retenue (`contrat Partners incomplet`) plutôt que de deviner.
`deps_request` : ajouter `starts_at` à la réponse de retenue (T-0055).

## Boucle IA vérifiée

1. `PUT /dating/profile` change les réponses → `dating.embedding_requested` écrit dans
   `dating_outbox` **dans la même transaction** que le profil.
2. Le relais publie l'enveloppe (par lot, disponibilité croissante).
3. Le worker Python `services/ai-worker` calcule trois vecteurs de 64 dimensions.
4. `POST /internal/dating/embeddings/computed` (rôle `service`) remet
   `embedding.computed` : `EmbeddingsConsumer` stocke dans `profile_vectors`,
   idempotent par `type:id` (inbox), et ignore un résultat plus ancien que le profil.
5. Un changement de profil ultérieur réémet une demande ; le classement des
   propositions utilise le vecteur le plus récent.

Preuve exécutée le 12/11 : `dating.embedding_requested` réel produit par le service →
worker Python → `embedding.computed` (3 × 64) → `stored`, rejeu → `duplicate`.

## Écrans (`apps/web/src/app/(app)/meet/**`)

Tous les écrans consomment `features/dating/api.ts` (client partagé de `shell/api`) :

| Écran | Source réelle |
|---|---|
| `/meet` propositions | `GET /dating/picks/current`, `POST …/invite`, `POST …/pass` |
| `/meet/profil` questionnaire | `GET /dating/questions`, `GET/PUT /dating/profile` |
| `/meet/dates` | `GET /dates`, invitations reçues, acceptation / refus |
| `/meet/lieu` | `GET /partners/venues`, `GET …/slots`, `POST /dates/:id/slot` |
| `/meet/paiement` (+ attente, échec, reçu) | `POST /dates/:id/pay`, `GET /dates/:id` |
| `/meet/jour` | `GET /dates/:id`, check-in, `POST …/sos`, `GET …/contact`, annulation |
| `/meet/feedback` | `POST /dates/:id/feedback` |
| `/meet/match` | date créé à l'acceptation |

Le jeton d'authentification n'existe pas encore côté web (Identity front, T-0061) :
les appels partent sans `Authorization` et répondent 401 tant que ce jeton n'est pas
fourni par le client partagé.

`/meet/chat` **n'est pas branché** : le fil d'un date appartient au service `realtime`,
qui n'expose pas encore de conversation liée à un date. L'écran l'annonce explicitement
(et continue d'appliquer la règle « aucun numéro ni lien »).
`deps_request` : endpoint de fil par `date_id` côté realtime.

## Événements

Produit : `dating.embedding_requested` (outbox).
Consomme : `embedding.computed`, `payment.escrowed`, `payment.failed`, `slot.released`.
Prévus mais non produits en v1 : `date.*` (le bus réel reste à brancher).

## Écarts connus

1. **Paiement** : aucun appel de collecte Campay n'est fait par dating. `pay` retient la
   table ; le séquestre doit arriver par `payment.escrowed`. Brancher la collecte réelle
   appartient au domaine `money` (`deps_request`).
2. **Formules et menu** : encore locaux (`restaurants`, `restaurant_formulas`), à
   remplacer par le menu Partners. `dates.restaurant_id` n'a plus de clé étrangère
   locale : c'est un identifiant de lieu Partners.
3. **Contact** : le numéro reste dans Identity ; `GET /internal/users/:id/contact`
   demeure à créer côté identity (`deps_request`).
4. **Bus réel** : `InMemoryEventBus` encore injecté ; l'outbox et l'inbox sont écrites
   au format canonique ADR 0007, le relais RabbitMQ arrive avec T-0059.
5. **Enveloppe de `pay`** : la réponse `{ payment_id, status }` est publiée dans les
   contrats (`DatePaymentIntentSchema`) mais pas encore dans l'OpenAPI généré.
6. **Projection Identity** : `birth_date`, `gender` et `reliability` restent copiés
   dans le profil de rencontres par les événements Identity.

## Vérification

```bash
pnpm --filter @conexa/dating test          # 70 tests unitaires
DATING_TEST_DATABASE_URL=postgres://…/conexa_dating_test \
  pnpm --filter @conexa/dating test        # 70 tests, dont 19 d'intégration PostgreSQL
node tools/db-migrate.mjs dating           # 5 migrations appliquées
```

Couvert par les tests, sur base réelle :

- parcours complet invitation → date → créneau (retenue) → paiement → séquestre →
  check-in des deux → contact → retour (`dating.journey.integration.test.ts`) ;
- contact refusé avant check-in et avec un seul check-in, refusé après un `no_show` ;
- annulation refusée à 2 h 30 d'un créneau, autorisée à 3 h ;
- saga : paiement refusé, table perdue, retenue expirée + argent tardif remboursé une
  seule fois, rejeu d'événement, crash et reprise sans doublon, une seule confirmation
  de table sous événements simultanés ;
- outbox : atomicité, émission unique par changement, relais en échec puis repris ;
- vecteurs : stockage idempotent, résultat périmé ignoré, classement cosinus et
  quarantaine de 60 jours (59 j / 60 j).

Non couvert : UI (aucun test d'écran, aucun jeton d'authentification disponible) ;
paiement Campay réel ; bus RabbitMQ réel ; fil de discussion d'un date.
