# Agent `realtime`

> WebSocket, notifications (internes et push web), chats (match, projet, commande de service), filtre anti-chiffres.

## Mission
Faire parvenir la bonne information à la bonne personne tout de suite, et garantir qu'aucun numéro ne circule dans les chats où c'est interdit.

## Propriété
<!-- OWNERSHIP:start (généré par tools/gen-agent-ownership.py, ne pas éditer) -->
Cet agent n'écrit **que** dans :

- `services/realtime/**`
- `services/messaging/**`
- `services/notifications/**`
- `db/migrations/messaging/**`
- `db/migrations/notifications/**`
- `packages/contracts/src/messaging/**`
- `packages/contracts/src/notifications/**`
- `packages/events/src/messaging/**`
- `apps/web/src/app/(app)/messages/**`
- `apps/web/src/app/(app)/notifications/**`
- `apps/web/src/features/realtime/**`
- `docs/domain/realtime.md`

Tout le reste est en lecture seule. Source : `agents/ownership.yaml`.
<!-- OWNERSHIP:end -->

## Interdit
- Autoriser un chiffre dans un chat de match, même masqué.
- Appliquer le filtre seulement côté client.
- Écrire dans la base d'un autre service.
- Journaliser le contenu des messages.

## Lire avant de commencer
`docs/product/README.md` §4.3 et §12 · `docs/product/schema.sql` (§4 Messagerie) · `docs/product/API.md` §3.4, §4, §5 · `docs/domain/realtime.md`.

## Règles métier critiques
- **Chat de match** : texte autorisé, **aucun chiffre** : `0-9`, chiffres Unicode (arabes-indiens, pleine chasse), emojis-chiffres, nombres écrits en lettres (français, anglais, argot local), contournements (`o` pour 0, `l` pour 1, espaces et ponctuation insérés), liens, `@pseudo`, mots de demande de contact (liste évolutive). Normalisation avant analyse. **Côté serveur**, avec un déclencheur SQL en défense en profondeur. Les horaires passent par des sélecteurs, pas par du texte.
- **Chat de projet et direct** : libre, avec signalement et anti-spam ; **chat de commande de service** : filtre optionnel jusqu'au paiement (à confirmer).
- 30 messages par minute au plus ; blocage d'un utilisateur = fin d'accès au fil.
- Une notification = un type du catalogue de `API.md` §5, un gabarit français, une préférence de canal ; reprise en cas d'échec d'envoi.
- Push web (VAPID) ; l'installation sur l'écran d'accueil peut être nécessaire sur certains appareils.
- Le fil d'un match est créé à `match.scheduled`, celui d'une commande à `service_order.requested`.

## Événements
Consomme presque tous les événements du système pour notifier ; produit `message.reported`.

## Écrans
Centre de notifications, liste des conversations, chat, signalement d'un message.

## Commandes
`pnpm turbo run lint typecheck test --filter=@conexa/realtime...` · `pnpm test:integration --filter=@conexa/realtime`

## Reçoit de / passe la main à
Tous les domaines (événements) · `identity` (jetons, blocages) · fournit les canaux temps réel au front.

## Définition de terminé
**Deux corpus de test versionnés** dans le dépôt : au moins 200 chaînes d'attaque qui doivent être bloquées et un corpus de phrases normales qui doivent passer (taux de faux positifs mesuré) · tests de charge WebSocket · reconnexion et reprise sans doublon.

## Validation humaine
`services/realtime/src/chat-filter/**` passe par la revue de sécurité.
