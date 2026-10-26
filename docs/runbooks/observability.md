# Runbook : observabilité de développement (F0.6)

Traces, métriques, journaux et erreurs de Convexa en local. Tout est démarré par
`pnpm dev:infra` (profil `observability`) et vit dans des volumes nommés.

## Accès

| Outil | URL | Identifiants |
|---|---|---|
| Grafana | http://localhost:3000 | `conexa` / `conexa_dev` (`GRAFANA_ADMIN_*`) |
| Prometheus | http://localhost:9090 | — |
| Loki | http://localhost:3100 | — |
| Tempo | http://localhost:3200 | — |
| OTLP (collecteur) | `localhost:4317` (gRPC), `localhost:4318` (HTTP) | — |
| RabbitMQ exporter | http://localhost:9419/metrics | — |

Les identifiants sont ceux du développement local, jamais des secrets réels.
Grafana provisionne ses sources et ses tableaux de bord au démarrage ; toute
modification faite dans l'interface est perdue au `pnpm dev:reset`.

## Flux

```text
service ──OTLP──► collecteur ──traces──► Tempo ──► Grafana
                       ├────────logs────► Loki  ──► Grafana
                       └────────metrics─► Prometheus ──► Grafana
Tempo (span metrics, service graph) ──remote write──► Prometheus
RabbitMQ ──management API──► rabbitmq-exporter ──► Prometheus
```

- Le collecteur supprime les attributs sensibles avant tout export (voir
  « Masquage PII »).
- Tempo génère les *span metrics* et le *service graph* depuis les traces :
  latence et erreurs par service sont disponibles même sans instrumentation
  métrique côté service.
- Les files sont lues par `rabbitmq-exporter`, pas par le collecteur.

## Tableaux de bord

| Tableau | Contenu |
|---|---|
| `Convexa · Services` | requêtes, taux d'erreur, latence p95 par service, cibles indisponibles |
| `Convexa · Files RabbitMQ` | messages prêts, consommateurs, débit publication/consommation, files de rebut |
| `Convexa · Paiements` | créés/réussis/échoués, taux de réussite, séquestre, journaux d'erreur |
| `Convexa · Notifications` | envoyées/échouées, SOS sans accusé, journaux temps réel |

Les panneaux `conexa_payments_*`, `conexa_notifications_*` et
`conexa_dating_sos_unacknowledged` sont un **contrat** avec les agents money et
realtime : ils restent vides tant que ces services n'émettent pas les métriques.
Les noms sont stables et ne doivent pas changer sans mise à jour de ce runbook
et des alertes.

## Corrélation journaux ↔ traces

Le contrat est le **W3C Trace Context** (`traceparent`, `tracestate`) :

1. Le gateway accepte ou crée un `traceparent` et le transmet à chaque appel
   HTTP interne ; le service continue le même contexte.
2. Un producteur RabbitMQ copie `traceparent` (et `tracestate`) dans les
   en-têtes du message ; le consommateur reprend ce contexte avant de traiter.
3. Chaque journal pino porte `trace_id`, `span_id` et `request_id` (noms
   snake_case, obligatoires pour le lien Grafana).
4. Aucun identifiant utilisateur, numéro ou matricule dans les attributs de
   trace ou les étiquettes de métrique.

Dans Grafana : un `trace_id` dans un journal ouvre la trace Tempo ; depuis une
 trace, « Logs for this span » filtre Loki sur le même identifiant. Les deux
liens sont provisionnés dans `deploy/observability/grafana/provisioning`.

## Masquage PII

Deux barrières, toutes deux obligatoires :

1. **Application** : pino/journalisation du kit de service masque le numéro
   WhatsApp, le matricule, les jetons et les numéros MoMo (`@conexa/service-kit`,
   T-0005) ; le test statique de T-0003 (`tools/check-pii-logs.py`) refuse un
   `logger` qui les cite sans masquage.
2. **Collecteur** : le processeur `transform` supprime les attributs `phone`,
   `whatsapp`, `msisdn`, `matricule`, `momo`, `otp`, `password`, `secret`,
   `token`, `access_token`, `refresh_token` et `authorization` des journaux,
   spans et points de métrique avant export.

Vérifications :

```bash
pnpm test:pii-masking          # politique du collecteur et liste obligatoire
pnpm test:observability        # configuration complète, sans Docker
pnpm test:observability:runtime  # journal + trace réels, Loki/Tempo/Grafana
```

Le test d'exécution envoie un faux numéro, un faux matricule et un faux jeton,
puis échoue si l'un d'eux apparaît dans Loki. Un masquage réussi ne justifie
jamais de journaliser une PII : la donnée ne doit pas être collectée.

## Sentry

Le DSN reste hors du dépôt (`deploy/observability/sentry.env.example`). Le
gabarit de service initialise Sentry avec `sendDefaultPii: false`, un
`beforeSend` qui supprime les mêmes champs que le collecteur, `release` = SHA
du commit et `tracesSampleRate` = `SENTRY_TRACES_SAMPLE_RATE`. Sentry est
optionnel en développement : sans DSN, aucune erreur n'est envoyée.

## Métriques métier attendues

| Métrique | Émetteur | Sens |
|---|---|---|
| `conexa_payments_created_total` | money | paiements initiés |
| `conexa_payments_succeeded_total` | money | paiements confirmés |
| `conexa_payments_failed_total` | money | échecs Campay |
| `conexa_payments_escrowed_total` | money | montants en séquestre |
| `conexa_payments_reconciliation_gap` | money | écart de rapprochement |
| `conexa_notifications_sent_total` | realtime | notifications envoyées |
| `conexa_notifications_failed_total` | realtime | notifications échouées |
| `conexa_dating_sos_unacknowledged` | dating | SOS sans accusé |
| `rabbitmq_queue_messages_ready` | exporter | profondeur de file |
| `rabbitmq_queue_consumers` | exporter | consommateurs connectés |
| `traces_spanmetrics_calls_total` | Tempo | requêtes par service et statut |
| `traces_spanmetrics_latency_bucket` | Tempo | latence (ms) par service |

Cardinalité : jamais d'identifiant utilisateur, de numéro ou de matricule en
étiquette. Les routes sont normalisées (`http.route`), pas les URL complètes.

## Alertes

`deploy/observability/alerts.yml` couvre : cible indisponible, taux d'erreur
> 5 %, p95 > 500 ms, file en retard (> 1 000 messages), file sans consommateur,
file de rebut non vide, échec de paiement, taux de réussite < 90 %, écart de
rapprochement, échec de notification et SOS sans accusé. Les seuils sont à
calibrer avec les données réelles ; toute alerte `critical` doit avoir un
runbook associé avant la production.

## Dépannage

- **Aucune trace** : vérifier que le service exporte vers `localhost:4317` ou
  `:4318`, que `otel-collector` tourne et que les cibles `tempo` et
  `otel-collector` sont `up` dans Prometheus.
- **Aucun journal** : vérifier `{service_name="..."}` dans Grafana ; Loki ne
  crée le label qu'après le premier envoi. Vérifier `loki` et l'exporteur
  `otlphttp/loki` du collecteur.
- **Panneau vide alors que le service tourne** : la métrique n'est pas encore
  émise ; vérifier son nom dans Prometheus (`/graph`).
- **Grafana affiche « datasource not found »** : les sources sont provisionnées
  au démarrage ; `pnpm dev:reset` puis `pnpm dev:infra`.
- **Disque plein** : rétention de 24 h pour Loki et Tempo, 7 jours pour
  Prometheus. `pnpm dev:reset` supprime les volumes.
- **Redémarrage propre** : `pnpm dev:down` conserve les données ;
  `pnpm dev:reset` repart de zéro.

## Limites du profil de développement

Pas de TLS, pas d'authentification des collecteurs, rétention courte, stockage
local, mono-instance. La préproduction et la production auront des collecteurs
et des backends gérés séparément (F6.4) ; ce runbook ne s'y applique pas.
