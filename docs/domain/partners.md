# Domaine partenaires (partners)

Lieux, menus, formules, créneaux et offres des partenaires. Le service ne stocke ni numéro
WhatsApp d'étudiant ni matricule, et ne touche jamais à l'argent (voir `docs/domain/money.md`).

## Retenue de créneau de 15 minutes (T-0055, F4.1)

Une retenue réserve une unité de la capacité d'un créneau pendant 15 minutes, le temps que
la saga de réservation d'un date (F4.5) encaisse le paiement.

| Étape | Appel interne (jeton de service, hors Gateway) | Événement |
|---|---|---|
| Retenir | `POST /internal/partners/slots/:id/hold` `{ hold_ref }` | `slot.held` ou `slot.rejected` |
| Confirmer (paiement reçu) | `POST /internal/partners/holds/:ref/confirm` | aucun |
| Libérer (annulation) | `POST /internal/partners/holds/:ref/release` | `slot.released` (`cancelled`) |
| Balayer les échues | `POST /internal/partners/holds/sweep` (et planificateur) | `slot.released` (`expired`) |
| Relayer l'outbox | `POST /internal/partners/outbox/relay` (et planificateur) | — |

Règles :

- **Concurrence** : le créneau est verrouillé (`select … for update`) pendant la décision ; sur la
  dernière table, une seule demande passe, les autres reçoivent `slot.rejected` (`SLOT_FULL`).
- **Idempotence** : `hold_ref` est unique. Rejouer la demande renvoie la même retenue.
- **Expiration seule** : `held` passe à `expired` à `expires_at`. Une retenue échue ne compte plus
  contre la capacité, même avant le balayage. Le balayage utilise `skip locked` et est rejouable.
- **Confirmation** : uniquement depuis `held` non échue. Sinon l'appelant reçoit l'état réel
  (`expired`, `released`) et la saga doit compenser.
- **Événements** : écrits dans `partners_outbox` dans la transaction métier (ADR 0007), schémas dans
  `packages/events/src/partners/`. `hold_ref` est opaque ; aucune donnée personnelle.
- Règles pures et testées : `services/partners/src/holds.rules.ts`.

Configuration : `PARTNERS_CRON_ENABLED` (défaut `true`), `PARTNERS_CRON_INTERVAL_MS` (défaut 30 000),
`SERVICE_TOKEN` pour les appels de service.

## Reste à faire pour F4.1

Contrats et API publique des organisations, candidatures et approbation admin ; contrats versionnés
(un seul actif) ; commission 10 % figée à la réservation (instantané du contrat) ; colonne du numéro
de reversement (trou n°2) ; compatibilité des routes `/restaurant/*` (restaurant_id = venue_id).

## Vérifier

```
pnpm --filter @conexa/partners lint typecheck test
PARTNERS_TEST_DATABASE_URL=postgres://… pnpm --filter @conexa/partners test   # concurrence, balayage
pnpm db:migrate partners
```
