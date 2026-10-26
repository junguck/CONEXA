# Convexa : Contrat d'API v1 (révision 2)

Base URL : `https://api.convexa.app/api/v1` · Format : JSON UTF-8 · Auth : `Authorization: Bearer <JWT>` (émis par le service Identity)

---

## 1. Conventions

| Sujet | Règle |
|---|---|
| Identifiants | UUID v4 (sauf `filiere_id`, `skill_id`, `field_id` : entiers) |
| Dates | ISO 8601 UTC (`2026-11-03T15:30:00Z`). Affichage en Africa/Douala (UTC+1) côté client |
| Montants | Entiers en **FCFA** (`amount_fcfa: 8000`), jamais de décimales |
| Pagination | Curseur : `?limit=20&cursor=<opaque>` → `{ "data": [...], "next_cursor": "..." \| null }` |
| Tri / filtres | `?sort=-created_at&filiere_id=3` |
| Idempotence | Header `Idempotency-Key` **obligatoire** sur `POST /dates/{id}/pay`, `/missions/{id}/fund`, `/events/{id}/tickets`, `/posts/{id}/boost`, `/service-orders/{id}/pay`, `/services/{id}/boost`, `/subscriptions`, `/subscriptions/{id}/renew`, `/partner-portal/deals/{id}/pay` |
| Rate limit | 120 req/min/utilisateur ; 10 req/min sur `/auth/*` ; 30 messages/min en chat. Réponse `429` + `Retry-After` |
| Versioning | Préfixe `/v1`. Changement cassant = `/v2` |
| Succès | `200` lecture/action · `201` création · `204` sans contenu |
| Calcul serveur | Elo, filtre de chiffres, révélation des numéros, paiements : **jamais côté client** |

### Rôles
`student` · `captain` (étudiant capitaine, contextuel) · `restaurant_staff` · `partner_staff` (membre du personnel d'une organisation partenaire ; `restaurant_staff` en est le cas d'un restaurant) · `moderator` · `admin` · `service` (webhooks/cron)

### Format d'erreur
```json
{
  "error": {
    "code": "CANCEL_WINDOW_CLOSED",
    "message": "Annulation impossible à moins de 3h du date.",
    "details": { "scheduled_at": "2026-11-03T15:30:00Z" },
    "request_id": "req_8f2c..."
  }
}
```

### Codes d'erreur métier
| Code | HTTP | Signification |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Jeton absent/expiré |
| `FORBIDDEN` | 403 | Rôle ou propriété insuffisants |
| `ACCOUNT_PENDING` | 403 | Compte non encore validé par l'admin |
| `ACCOUNT_SUSPENDED` | 403 | Compte suspendu/banni |
| `NOT_FOUND` | 404 | Ressource inexistante ou invisible |
| `VALIDATION_ERROR` | 422 | Champs invalides (détails par champ) |
| `INVALID_STATE` | 409 | Transition d'état interdite |
| `RATE_LIMITED` | 429 | Trop de requêtes |
| `MATRICULE_TAKEN` | 409 | Matricule déjà utilisé |
| `OTP_INVALID` | 400 | Code OTP faux/expiré |
| `AGE_RESTRICTED` | 403 | Moins de 18 ans : module rencontres interdit |
| `RELIABILITY_TOO_LOW` | 403 | Score de fiabilité < 40 |
| `TEAM_ALREADY_MEMBER` | 409 | Joueur déjà dans une équipe |
| `TEAM_JOIN_COOLDOWN` | 409 | Gel de 7 jours après avoir quitté une équipe |
| `TEAM_NOT_ACTIVE` | 409 | Équipe sous l'effectif minimum |
| `NOT_CAPTAIN` | 403 | Action réservée au capitaine |
| `FIELD_SLOT_TAKEN` | 409 | Terrain déjà réservé à ce créneau |
| `REPORT_ALREADY_SUBMITTED` | 409 | Capitaine a déjà déclaré le score |
| `CHAT_DIGIT_BLOCKED` | 422 | Message contenant un chiffre/numéro (même masqué) |
| `CHAT_CONTACT_BLOCKED` | 422 | Lien, @pseudo ou demande de contact bloqué |
| `WEEKLY_QUOTA_EXCEEDED` | 409 | Plus de 3 invitations cette semaine |
| `PICK_EXPIRED` | 409 | Proposition hebdo expirée |
| `SLOT_FULL` | 409 | Plus de table disponible sur ce créneau |
| `FORMULA_CAP_EXCEEDED` | 422 | Commande au-dessus du plafond de la formule |
| `PAYMENT_REQUIRED` | 402 | Paiement non effectué |
| `CANCEL_WINDOW_CLOSED` | 409 | Moins de 3h avant le date |
| `CONTACT_NOT_REVEALED` | 403 | Pas de « oui » mutuel |
| `ALREADY_BLOCKED` | 409 | Utilisateur bloqué |
| `DUPLICATE_REQUEST` | 409 | Idempotency-Key déjà utilisée avec un autre corps |
| `ENTITLEMENT_REQUIRED` | 403 | Fonction réservée à un abonnement (`details.required_plan`) |
| `PLAN_LIMIT_REACHED` | 409 | Quota du plan atteint (offres actives, événements du mois…) |
| `PLAN_NOT_FOUND` | 404 | Plan inconnu ou inactif |
| `PLAN_AUDIENCE_MISMATCH` | 422 | Plan non destiné à ce type de sujet (utilisateur, équipe, partenaire) |
| `PROMO_INVALID` | 422 | Code promo inconnu, expiré ou épuisé |
| `LISTING_NOT_ACTIVE` | 409 | Offre de service non active |
| `LISTING_PROHIBITED` | 422 | Offre contenant un terme interdit (fraude académique) |
| `SELF_ORDER_FORBIDDEN` | 409 | Commande de sa propre offre |
| `SLOT_ALREADY_BOOKED` | 409 | Créneau de prestation déjà réservé |
| `REVISIONS_EXHAUSTED` | 409 | Plus de révisions disponibles pour cette commande |
| `ORDER_NOT_COMPLETED` | 409 | Avis possible seulement sur une commande terminée |
| `OFFER_NOT_AVAILABLE` | 409 | Offre partenaire inactive ou hors période |
| `OFFER_SOLD_OUT` | 409 | Stock de l'offre épuisé |
| `OFFER_LIMIT_REACHED` | 409 | Limite de bons par étudiant atteinte |
| `VOUCHER_INVALID` | 404 | Code de bon inconnu |
| `VOUCHER_ALREADY_USED` | 409 | Bon déjà consommé |
| `VOUCHER_EXPIRED` | 409 | Bon périmé |
| `PARTNER_NOT_ACTIVE` | 403 | Organisation partenaire non active |
| `ASSET_NOT_APPROVED` | 409 | Visuel de bannière non approuvé |

---

## 2. Schémas partagés

```jsonc
// PublicUser
{ "id": "uuid", "full_name": "Aïcha N.", "photo_url": "https://...", "filiere": {"id": 3, "name": "Gestion"},
  "study_level": 2, "team": {"id": "uuid", "name": "Les Lions"} | null, "reliability_band": "high|medium|low" }

// Me (étend PublicUser)
{ ..., "birth_date": "2004-05-10", "gender": "female", "status": "pending|active|suspended|banned",
  "role": "student", "reliability": 82, "whatsapp_masked": "+237 6** *** **12",
  "dating_enabled": true }

// Team
{ "id": "uuid", "name": "Les Lions", "logo_url": null, "filiere": {...}, "captain": PublicUser,
  "elo": 1180, "level": "gold", "is_ranked": true, "school_rank": 4, "filiere_rank": 1,
  "record": {"played": 12, "wins": 8, "draws": 2, "losses": 2, "gf": 31, "ga": 14},
  "members_count": 9, "recruiting": true }

// Match
{ "id": "uuid", "team_a": Team, "team_b": Team, "field": {"id": 1, "name": "Terrain principal"},
  "scheduled_at": "...", "status": "scheduled|awaiting_reports|validated|disputed|forfeit|cancelled",
  "score_a": 3, "score_b": 1, "winner_team_id": "uuid|null", "thread_id": "uuid",
  "report_deadline": "...", "my_report_submitted": false }

// MatchEvent
{ "type": "goal|assist|yellow_card|red_card|own_goal", "team_id": "uuid",
  "player_id": "uuid", "assist_id": "uuid|null", "minute": 34 }

// DatingPick
{ "id": "uuid", "kind": "similar|complementary", "candidate": {"first_name": "Aïcha", "age": 21,
  "photo_url": "...", "filiere": "Gestion", "traits": ["curieuse", "sportive", "calme"]},
  "compat_label": "Très compatible", "decision": "none|invited|passed", "week_start": "2026-10-19" }
// ⚠ Aucun score numérique, aucun contact exposé.

// Date
{ "id": "uuid", "status": "negotiating|awaiting_payment|confirmed|checked_in|completed|cancelled|no_show|disputed",
  "partner": {"first_name": "Aïcha", "photo_url": "..."},   // photo révélée selon la règle produit (question ouverte n°1)
  "payer_id": "uuid", "i_am_payer": true,
  "restaurant": {"id": "uuid", "name": "..."}, "slot": {"id": "uuid", "starts_at": "..."},
  "formula": {"id": "uuid", "name": "Confort", "per_person_cap_fcfa": 4500},
  "total_fcfa": 8000, "commission_fcfa": 800, "table_label": "T5",
  "cancellable_until": "2026-11-03T12:30:00Z", "can_cancel": true,
  "contact_revealed": false, "my_orders": [...], "partner_ordered": true }

// DateCard (messagerie sans texte)
{ "id": "uuid", "sender_id": "uuid", "card_type": "SLOT_PROPOSE", "payload": {"slot_id": "uuid"}, "created_at": "..." }
// Types : SLOT_PROPOSE, SLOT_ACCEPT, SLOT_DECLINE, FORMULA_SELECT, ORDER_DONE, ARRIVE_EARLY, SHY,
//         LATE_5, LATE_10, LATE_15, READY, CONFIRM_YES, CONFIRM_NO, THANKS

// Payment
{ "id": "uuid", "object_type": "date|mission|ticket|boost", "object_id": "uuid", "amount_fcfa": 8000,
  "provider": "mtn_momo|orange_money|credit", "status": "pending|escrow|released|refund_pending|refunded|failed",
  "payment_url": "https://...|null", "created_at": "..." }

// Post
{ "id": "uuid", "kind": "need|project|competition|service_offer|help_request", "title": "...",
  "description": "...", "budget_fcfa": 15000|null, "skills": [{"id": 1, "name": "Graphisme"}],
  "author": PublicUser, "status": "open", "boosted": false, "created_at": "..." }

// Notification
{ "id": "uuid", "type": "match.challenge.received", "payload": {...}, "read": false, "created_at": "..." }
```

### Schémas (révision 2) : services, abonnements, partenariats

```jsonc
// ServiceListing
{ "id": "uuid", "provider": PublicUser,
  "category": {"id": 3, "slug": "design", "name": "Design et graphisme"},
  "title": "Logo + charte graphique", "description": "...",
  "pricing": "fixed|hourly|quote", "delivery_mode": "remote|in_person|both", "location": "Campus",
  "tags": ["logo"], "portfolio_urls": ["https://..."], "packages": [ServicePackage],
  "rating_avg": 4.8, "rating_count": 12, "orders_completed": 15, "boosted": false,
  "status": "draft|pending_review|active|paused|rejected|archived", "favorited": false }

// ServicePackage
{ "id": "uuid", "tier": "basic|standard|premium", "name": "Logo simple", "description": "...",
  "price_fcfa": 5000, "delivery_days": 3, "revisions": 2 }

// ServiceOrder
{ "id": "uuid", "listing": {"id": "uuid", "title": "..."}, "package": ServicePackage | null,
  "slot": {"id": "uuid", "starts_at": "...", "ends_at": "..."} | null,
  "client": PublicUser, "provider": PublicUser,
  "status": "requested|accepted|funded|in_progress|delivered|revision_requested|completed|cancelled|disputed|refunded",
  "amount_fcfa": 5000, "commission_pct": 8.0, "commission_fcfa": 400, "provider_net_fcfa": 4600,
  "requirements": "...", "revisions_left": 2, "deadline_at": "...", "auto_complete_at": "...|null",
  "thread_id": "uuid", "my_role": "client|provider", "can": ["accept", "cancel"] }

// Plan
{ "code": "STUDENT_PLUS", "audience": "student|organizer|team|partner", "name": "Étudiant Plus",
  "description": "...", "price_fcfa": 1500, "period_days": 30, "entitlements": {"max_active_listings": 10, ...} }

// Subscription
{ "id": "uuid", "plan": Plan, "subject_kind": "user|team|partner", "subject_id": "uuid",
  "status": "pending_payment|active|grace|expired|cancelled",
  "current_period_end": "...", "grace_until": "...|null", "cancel_at_period_end": false }

// Entitlements
{ "subject_kind": "user", "subject_id": "uuid",
  "entitlements": {"service_commission_pct": 5, "max_active_listings": 10, "boosts_per_month": 1},
  "usage": {"max_active_listings": 4} }   // consommation courante pour les droits à quota

// Organization (partenaire)
{ "id": "uuid", "kind": "restaurant|merchant|sponsor|telecom|media|institution", "name": "...",
  "logo_url": "...", "website": "...", "description": "...", "status": "active" }

// Offer
{ "id": "uuid", "organization": Organization, "title": "-20 % sur les burgers",
  "description": "...", "kind": "percent|fixed|freebie", "value": 20, "conditions": "...",
  "requires_entitlement": "STUDENT_PLUS|null", "remaining": 37|null, "per_user_limit": 1,
  "valid_until": "...|null", "claimed_by_me": false }

// Voucher
{ "id": "uuid", "offer": Offer, "code": "A1B2C3D4E5", "qr_payload": "cl:v1:A1B2C3D4E5",
  "status": "issued|redeemed|expired|cancelled", "expires_at": "..." }

// SponsorshipDeal
{ "id": "uuid", "organization": Organization, "package": {"tier": "gold", "name": "Or"} | null,
  "target": {"type": "competition|event|team|app_section", "id": "uuid|null"},
  "amount_fcfa": 200000, "in_kind_value_fcfa": 0,
  "status": "proposed|negotiating|accepted|paid|active|completed|cancelled",
  "starts_on": "2026-11-01", "ends_on": "2026-12-15", "deliverables": ["logo", "bannière"] }

// AdPlacement (diffusion)
{ "id": "uuid", "slot": "home_banner", "asset_url": "https://...", "asset_kind": "banner",
  "partner_name": "...", "click_url": "https://..." }
```

---

## 3. Endpoints

Légende : **Auth** = `—` public · `U` utilisateur actif · `U*` utilisateur même en attente · `C` capitaine · `R` restaurant · `M` modérateur · `A` admin · `S` service.

### 3.1 Authentification et compte

| Méthode | Route | Auth | Corps → Réponse | Erreurs |
|---|---|---|---|---|
| POST | `/auth/otp/request` | — | `{ whatsapp: "+2376XXXXXXXX" }` → `204` | `RATE_LIMITED` |
| POST | `/auth/otp/verify` | — | `{ whatsapp, code }` → `{ access_token, refresh_token, expires_in, is_new_user }` | `OTP_INVALID` |
| POST | `/auth/refresh` | — | `{ refresh_token }` → tokens | `UNAUTHENTICATED` |
| POST | `/auth/logout` | U* | → `204` | |
| POST | `/me/register` | U* | `{ full_name, matricule, birth_date, gender, filiere_id, study_level, photo_upload_id, consent: true }` → `Me` (status `pending`) | `MATRICULE_TAKEN`, `VALIDATION_ERROR` |
| POST | `/uploads/photo` | U* | `{ content_type: "image/jpeg" }` → `{ upload_id, upload_url, expires_in }` (URL signée, max 5 Mo) | |
| GET | `/me` | U* | → `Me` | |
| PATCH | `/me` | U* | `{ full_name?, photo_upload_id?, filiere_id?, study_level? }` → `Me` | |
| DELETE | `/me` | U | → `204` (anonymisation et suppression des données personnelles) | |
| GET | `/me/reliability` | U | → `{ score, band, events: [{delta, reason, created_at}] }` | |
| GET | `/filieres` | — | → `[{ id, name }]` | |
| GET | `/users/{id}` | U | → `PublicUser` + stats foot + compétences | `NOT_FOUND` |
| GET | `/users?q=&filiere_id=&team=none` | U | → page de `PublicUser` (recherche joueurs libres) | |
| GET | `/me/blocks` | U | → `[PublicUser]` | |
| POST | `/users/{id}/block` | U | → `204` | |
| DELETE | `/users/{id}/block` | U | → `204` | |
| POST | `/reports` | U | `{ target_type, target_id, reason, details? }` → `201 { id }` | |
| POST | `/me/push-subscriptions` | U | `{ endpoint, keys: { p256dh, auth } }` → `201` | |
| DELETE | `/me/push-subscriptions` | U | `{ endpoint }` → `204` | |
| GET | `/notifications` | U | → page de `Notification` | |
| POST | `/notifications/{id}/read` | U | → `204` | |
| POST | `/notifications/read-all` | U | → `204` | |
| GET | `/config` | U* | → `{ cancel_window_hours: 3, weekly_invites: 3, min_dating_age: 18, team_min_players: 7, min_reliability: 40 }` | |
| GET | `/health` | — | → `{ status: "ok" }` | |

### 3.2 Football : équipes

| Méthode | Route | Auth | Corps → Réponse | Erreurs |
|---|---|---|---|---|
| POST | `/teams` | U | `{ name, filiere_id, logo_upload_id? }` → `201 Team` (l'auteur devient capitaine) | `TEAM_ALREADY_MEMBER`, `TEAM_JOIN_COOLDOWN` |
| GET | `/teams?q=&filiere_id=&level=&recruiting=true` | U | → page de `Team` | |
| GET | `/teams/{id}` | U | → `Team` | |
| PATCH | `/teams/{id}` | C | `{ name?, logo_upload_id?, recruiting? }` → `Team` | `NOT_CAPTAIN` |
| DELETE | `/teams/{id}` | C | → `204` (dissolution, historique conservé) | |
| GET | `/me/team` | U | → `Team` + `my_role` ou `null` | |
| GET | `/teams/{id}/members` | U | → `[{ user: PublicUser, role, position, goals, assists }]` | |
| POST | `/teams/{id}/invites` | C | `{ user_id }` → `201` | `TEAM_ALREADY_MEMBER` |
| POST | `/teams/{id}/join-requests` | U | `{}` → `201` | `TEAM_ALREADY_MEMBER`, `TEAM_JOIN_COOLDOWN` |
| GET | `/teams/{id}/join-requests` | C | → liste des demandes en attente | |
| GET | `/me/team-invites` | U | → invitations reçues | |
| POST | `/team-invites/{id}/accept` | U/C | → `204` (le destinataire accepte une invitation, ou le capitaine accepte une demande) | `TEAM_ALREADY_MEMBER` |
| POST | `/team-invites/{id}/decline` | U/C | → `204` | |
| POST | `/teams/{id}/members/{userId}/remove` | C | → `204` | |
| POST | `/teams/{id}/leave` | U | → `204` (gel de 7 jours) | `INVALID_STATE` (capitaine : transférer d'abord) |
| POST | `/teams/{id}/transfer-captain` | C | `{ user_id }` → `204` | |
| PATCH | `/teams/{id}/members/{userId}` | C | `{ position }` → `204` | |
| GET | `/teams/{id}/matches?status=` | U | → page de `Match` | |
| GET | `/teams/{id}/elo-history` | U | → `[{ match_id, elo_before, elo_after, at }]` | |
| GET | `/teams/{id}/stats` | U | → `{ record, form: ["W","W","D","L","W"], top_scorers: [...] }` | |

### 3.3 Football : terrains, défis, matchs

| Méthode | Route | Auth | Corps → Réponse | Erreurs |
|---|---|---|---|---|
| GET | `/fields` | U | → `[{ id, name, location }]` | |
| GET | `/fields/{id}/availability?date=2026-11-03` | U | → `[{ starts_at, available }]` | |
| POST | `/challenges` | C | `{ to_team_id, field_id, proposed_at }` → `201 Challenge` | `TEAM_NOT_ACTIVE`, `FIELD_SLOT_TAKEN` |
| GET | `/challenges?box=sent\|received&status=` | C | → page | |
| POST | `/challenges/{id}/accept` | C | → `201 Match` (crée le match, le fil de chat des capitaines, les rappels) | `FIELD_SLOT_TAKEN`, `INVALID_STATE` |
| POST | `/challenges/{id}/decline` | C | → `204` | |
| POST | `/challenges/{id}/counter` | C | `{ field_id, proposed_at }` → `201 Challenge` (contre-proposition) | |
| POST | `/challenges/{id}/cancel` | C | → `204` | |
| GET | `/matches?status=&team_id=&from=&to=` | U | → page de `Match` | |
| GET | `/matches/{id}` | U | → `Match` + `events` + `lineups` + `mvp` | |
| POST | `/matches/{id}/lineup` | C | `{ player_ids: [uuid] }` → `204` | |
| POST | `/matches/{id}/report` | C | `{ score_a, score_b, events: [MatchEvent], evidence_upload_ids?: [] }` → `{ status: "waiting_other"\|"validated"\|"disputed" }` | `REPORT_ALREADY_SUBMITTED`, `INVALID_STATE` |
| GET | `/matches/{id}/report` | C | → ma déclaration (jamais celle de l'autre tant que non validé) | |
| POST | `/matches/{id}/contest` | C | `{ reason, evidence_upload_ids }` → `204` (fenêtre de 48 h) | |
| POST | `/matches/{id}/mvp-vote` | U | `{ player_id }` → `204` (réservé aux joueurs de l'équipe **adverse**) | `FORBIDDEN` |
| POST | `/matches/{id}/cancel` | C | `{ reason }` → `204` (annulation avant H-2, accord requis de l'autre capitaine) | |
| POST | `/matches/{id}/forfeit` | C | → `204` (déclare forfait de l'adversaire absent, soumis à preuve) | |

**Règle de validation** : quand les deux rapports existent, le serveur appelle `finalize_match` : scores et événements identiques → `validated`, Elo mis à jour, stats joueurs mises à jour, badges évalués ; sinon → `disputed` (traité par admin). Si un capitaine ne répond pas sous 24 h, la déclaration de l'autre est acceptée provisoirement avec contestation possible 48 h.

### 3.4 Football : chat capitaines

| Méthode | Route | Auth | Corps → Réponse | Erreurs |
|---|---|---|---|---|
| GET | `/threads?kind=match\|post\|direct` | U | → liste avec dernier message et non-lus | |
| GET | `/threads/{id}/messages?cursor=` | U (participant) | → page de messages | `FORBIDDEN` |
| POST | `/threads/{id}/messages` | U (participant) | `{ body }` → `201 Message` | `CHAT_DIGIT_BLOCKED`, `CHAT_CONTACT_BLOCKED` |
| POST | `/threads/{id}/read` | U | → `204` | |
| POST | `/threads/{id}/messages/{mid}/report` | U | `{ reason }` → `204` | |

**Filtre appliqué aux threads `match`** (serveur) : normalisation (retrait espaces/ponctuation/caractères invisibles/homoglyphes) → rejet des chiffres Unicode et emojis-chiffres → détection des nombres en lettres (FR/EN/argot) → détection de contournements (« zéro six »…) → rejet des liens, `@pseudo`, « whatsapp/appelle-moi/dm ». Les horaires se fixent par `/challenges` (sélecteur), pas par texte.

### 3.5 Football : classements, joueurs, badges

| Méthode | Route | Auth | Corps → Réponse |
|---|---|---|---|
| GET | `/rankings/teams?scope=school\|filiere\|level&filiere_id=&level=&period=season\|month` | U | → `[{ rank, team, elo, level, form }]` |
| GET | `/rankings/players?metric=goals\|assists\|rating\|mvp\|clean_sheets&period=month\|season&filiere_id=` | U | → `[{ rank, user: PublicUser, value, matches }]` |
| GET | `/players/{id}/stats` | U | → `{ matches, goals, assists, mvp_votes, rating, form, history: [...] }` |
| GET | `/players/{id}/badges` | U | → `[{ code, name, awarded_at }]` |
| GET | `/me/match-history` | U | → page de matchs du joueur avec sa contribution |
| GET | `/hall-of-fame` | U | → `{ golden_boot: [...], teams_of_season: [...], champions: [...] }` |

### 3.6 Football : compétitions

| Méthode | Route | Auth | Corps → Réponse |
|---|---|---|---|
| GET | `/competitions?status=` | U | → liste |
| POST | `/competitions` | U/A | `{ name, kind, starts_on, ends_on?, entry_fee_fcfa?, max_teams?, sponsor_name? }` → `201` |
| GET | `/competitions/{id}` | U | → détails |
| POST | `/competitions/{id}/register` | C | `{}` → `201` (paiement si droit d'inscription) |
| GET | `/competitions/{id}/standings` | U | → classement (poules) |
| GET | `/competitions/{id}/fixtures` | U | → calendrier |
| POST | `/competitions/{id}/draw` | organisateur | → génère poules/tableau |

### 3.7 Rencontres : profil et picks

| Méthode | Route | Auth | Corps → Réponse | Erreurs |
|---|---|---|---|---|
| GET | `/dating/eligibility` | U | → `{ eligible, reasons: ["AGE_RESTRICTED"\|"QUESTIONNAIRE_MISSING"\|"RELIABILITY_TOO_LOW"] }` | |
| GET | `/dating/questionnaire` | U | → `{ version, blocks: [{ key: "values"\|"personality"\|"lifestyle", questions: [...] }] }` | |
| PUT | `/dating/profile` | U | `{ questionnaire_v, answers, seeking: ["female"], age_min, age_max }` → `Profile` (déclenche le calcul des embeddings) | `AGE_RESTRICTED`, `VALIDATION_ERROR` |
| GET | `/dating/profile` | U | → mes réponses et préférences (jamais les vecteurs) | |
| PATCH | `/dating/preferences` | U | `{ seeking?, age_min?, age_max? }` → `204` | |
| POST | `/dating/pause` | U | → `204` (profil retiré des propositions) | |
| POST | `/dating/resume` | U | → `204` | |
| GET | `/dating/picks/current` | U | → `{ week_start, quota_left, picks: [DatingPick] }` (3 max : 2 `similar` + 1 `complementary`) | `RELIABILITY_TOO_LOW` |
| POST | `/dating/picks/{id}/invite` | U | `{}` → `201 Invite` | `WEEKLY_QUOTA_EXCEEDED`, `PICK_EXPIRED` |
| POST | `/dating/picks/{id}/pass` | U | → `204` | |
| GET | `/dating/invites?box=received\|sent` | U | → liste | |
| POST | `/dating/invites/{id}/accept` | U | → `201 Date` (ouvre la négociation) | `INVALID_STATE` |
| POST | `/dating/invites/{id}/decline` | U | → `204` (formulation neutre côté émetteur : « pas cette fois ») | |
| POST | `/dating/invites/{id}/withdraw` | U | → `204` | |

### 3.8 Rencontres : date, négociation, paiement

| Méthode | Route | Auth | Corps → Réponse | Erreurs |
|---|---|---|---|---|
| GET | `/dates?status=` | U | → liste de `Date` | |
| GET | `/dates/{id}` | U (participant) | → `Date` | `FORBIDDEN` |
| GET | `/dates/card-catalog` | U | → `[{ card_type, label_fr, expects_payload }]` | |
| GET | `/dates/{id}/cards` | U | → `[DateCard]` | |
| POST | `/dates/{id}/cards` | U | `{ card_type, payload? }` → `201 DateCard` (aucun texte libre accepté) | `VALIDATION_ERROR` |
| GET | `/restaurants/{rid}/slots?from=&to=` | U | → `[{ id, starts_at, available }]` | |
| GET | `/restaurants/{rid}/formulas` | U | → `[{ id, name, per_person_cap_fcfa, items: [MenuItem] }]` | |
| POST | `/dates/{id}/slot` | U | `{ slot_id }` → `Date` (verrouille la table si les deux ont accepté un `SLOT_PROPOSE`) | `SLOT_FULL` |
| POST | `/dates/{id}/formula` | payeur | `{ formula_id }` → `Date` | `FORBIDDEN` |
| POST | `/dates/{id}/orders` | U | `{ items: [{ menu_item_id, quantity }], allergy_note? }` → `Date` (chacun commande **pour soi** dans la formule) | `FORMULA_CAP_EXCEEDED` |
| POST | `/dates/{id}/pay` | payeur | Header `Idempotency-Key` · `{ provider: "mtn_momo"\|"orange_money", phone_msisdn }` → `201 Payment` (montant = total des 2 commandes) | `INVALID_STATE`, `DUPLICATE_REQUEST` |
| POST | `/dates/{id}/cancel` | U | → `204` (remboursement du payeur) | `CANCEL_WINDOW_CLOSED`, `INVALID_STATE` |
| POST | `/dates/{id}/checkin` | U | `{ code }` → `Date` (le code est donné à l'accueil, la photo du partenaire est révélée une fois sur place) | `INVALID_STATE` |
| POST | `/dates/{id}/sos` | U | `{}` → `204` (alerte restaurant + admin, tout de suite) | |
| POST | `/dates/{id}/feedback` | U | `{ wants_contact: true, criteria: { conversation: 1-5, values: 1-5, attraction: 1-5, punctuality: 1-5 } }` → `204` (l'autre réponse n'est jamais montrée) | `INVALID_STATE` |
| GET | `/dates/{id}/contact` | U | → `{ whatsapp: "+2376XXXXXXXX" }` uniquement si « oui » mutuel | `CONTACT_NOT_REVEALED` |
| POST | `/dates/{id}/report` | U | `{ reason, details? }` → `204` | |
| GET | `/me/credits` | U | → `[{ id, amount_fcfa, reason, expires_at, used }]` | |

**Machine d'états d'un date**
`negotiating → awaiting_payment → confirmed → checked_in → completed`
Sorties : `cancelled` (≥ 3 h avant) · `no_show` (absence) · `disputed` (litige admin).

### 3.9 Restaurant (rôle `restaurant_staff`)

| Méthode | Route | Corps → Réponse |
|---|---|---|
| GET | `/restaurant/dashboard?date=` | → `{ dates_count, covers, revenue_fcfa, commission_fcfa, next_dates: [...] }` |
| GET | `/restaurant/dates?date=&status=` | → liste (prénoms, table, créneau, plats par personne, allergies, statut paiement) |
| GET | `/restaurant/dates/{id}` | → détail |
| POST | `/restaurant/dates/{id}/table` | `{ table_label }` → `204` |
| POST | `/restaurant/dates/{id}/checkin-confirm` | `{ user_id }` → `204` (valide l'arrivée) |
| POST | `/restaurant/dates/{id}/service` | `{ status: "preparing"\|"served"\|"done" }` → `204` |
| POST | `/restaurant/dates/{id}/no-show` | `{ user_id }` → `204` |
| GET | `/restaurant/menu` | → `[MenuItem]` |
| POST | `/restaurant/menu` | `{ name, description?, price_fcfa, category, photo_upload_id? }` → `201` |
| PATCH | `/restaurant/menu/{id}` | `{ price_fcfa?, is_available?, ... }` → `MenuItem` |
| DELETE | `/restaurant/menu/{id}` | → `204` |
| GET | `/restaurant/formulas` | → liste |
| POST | `/restaurant/formulas` | `{ name, per_person_cap_fcfa, menu_item_ids: [] }` → `201` |
| PATCH | `/restaurant/formulas/{id}` | → `Formula` |
| DELETE | `/restaurant/formulas/{id}` | → `204` |
| GET | `/restaurant/slots?from=&to=` | → `[{ id, starts_at, tables_total, tables_booked }]` |
| POST | `/restaurant/slots` | `{ starts_at, tables_total }` → `201` |
| POST | `/restaurant/slots/bulk` | `{ days: [...], times: ["18:00","19:30"], tables_total }` → `201 { created }` |
| PATCH | `/restaurant/slots/{id}` | `{ tables_total }` → `Slot` |
| DELETE | `/restaurant/slots/{id}` | → `204` (seulement si 0 réservation) |
| GET | `/restaurant/finance/summary?from=&to=` | → `{ gross_fcfa, commission_fcfa, net_fcfa, pending_payout_fcfa }` |
| GET | `/restaurant/payouts` | → `[Payout]` |
| GET | `/restaurant/ledger?from=&to=` | → écritures détaillées |
| POST | `/restaurant/sos/{dateId}/ack` | `{}` → `204` (accuse réception de l'alerte) |

### 3.10 Projets et compétences

| Méthode | Route | Auth | Corps → Réponse | Erreurs |
|---|---|---|---|---|
| GET | `/skills?q=` | U | → `[{ id, name, category }]` | |
| PUT | `/me/skills` | U | `{ skills: [{ skill_id, level, proof_url? }], bio? }` → `204` (recalcule l'embedding) | |
| GET | `/users/{id}/skills` | U | → compétences et avis | |
| POST | `/posts` | U | `{ kind, title, description, budget_fcfa?, skill_ids: [] }` → `201 Post` (embedding généré) | |
| GET | `/posts?kind=&skill_id=&q=&mine=true&status=open` | U | → page de `Post` (posts boostés en premier) | |
| GET | `/posts/recommended` | U | → posts proches de mes compétences (similarité cosinus) | |
| GET | `/posts/{id}` | U | → `Post` | |
| PATCH | `/posts/{id}` | auteur | → `Post` | |
| POST | `/posts/{id}/close` | auteur | → `204` | |
| DELETE | `/posts/{id}` | auteur | → `204` | |
| GET | `/posts/{id}/suggested-users` | auteur | → profils compatibles avec le besoin | |
| POST | `/posts/{id}/apply` | U | `{ message? }` → `201` | |
| GET | `/posts/{id}/applications` | auteur | → liste | |
| POST | `/applications/{id}/accept` | auteur | → `204` (ouvre un fil de discussion) | |
| POST | `/applications/{id}/decline` | auteur | → `204` | |
| POST | `/applications/{id}/withdraw` | U | → `204` | |
| POST | `/posts/{id}/boost` | auteur | Header `Idempotency-Key` · `{ days: 3\|7, provider, phone_msisdn }` → `201 Payment` | |
| POST | `/threads` | U | `{ kind: "direct"\|"post", user_id? , post_id? }` → `201 Thread` (messagerie **libre** hors match) | `ALREADY_BLOCKED` |
| POST | `/meetups` | U | `{ invitee_id, post_id?, place, starts_at }` → `201` (« meeter ») | |
| GET | `/meetups` | U | → liste | |
| POST | `/meetups/{id}/accept` | U | → `204` | |
| POST | `/meetups/{id}/decline` | U | → `204` | |

### 3.11 Missions rémunérées et avis

| Méthode | Route | Auth | Corps → Réponse |
|---|---|---|---|
| POST | `/missions` | auteur du post | `{ post_id, provider_id, amount_fcfa, deadline_at? }` → `201` (statut `proposed`) |
| GET | `/missions?role=client\|provider&status=` | U | → liste |
| POST | `/missions/{id}/accept` | prestataire | → `204` |
| POST | `/missions/{id}/fund` | client | Header `Idempotency-Key` · `{ provider, phone_msisdn }` → `201 Payment` (séquestre) |
| POST | `/missions/{id}/deliver` | prestataire | `{ note?, file_upload_ids? }` → `204` |
| POST | `/missions/{id}/approve` | client | → `204` (libère les fonds moins la commission) |
| POST | `/missions/{id}/dispute` | client/prestataire | `{ reason }` → `204` |
| POST | `/missions/{id}/cancel` | client | → `204` (remboursement si non livré) |
| POST | `/reviews` | U | `{ mission_id, rating: 1-5, comment? }` → `201` |
| GET | `/users/{id}/reviews` | U | → page |

### 3.12 Événements et billets

| Méthode | Route | Auth | Corps → Réponse |
|---|---|---|---|
| GET | `/events?from=&status=` | U | → liste |
| POST | `/events` | U | `{ title, description?, place, starts_at, price_fcfa?, capacity?, sponsor_name? }` → `201` |
| GET | `/events/{id}` | U | → détails |
| POST | `/events/{id}/register` | U | `{}` → `201` (gratuit) |
| POST | `/events/{id}/tickets` | U | Header `Idempotency-Key` · `{ provider, phone_msisdn }` → `201 Payment` |
| POST | `/events/{id}/checkin` | organisateur | `{ user_id }` → `204` |

### 3.13 Paiements

| Méthode | Route | Auth | Corps → Réponse |
|---|---|---|---|
| GET | `/payments/{id}` | U | → `Payment` |
| GET | `/me/payments` | U | → page |
| POST | `/webhooks/payments/mtn_momo` | S | Signature HMAC `X-Signature` · corps du prestataire → `200` (idempotent via `webhook_events`) |
| POST | `/webhooks/payments/orange_money` | S | idem |

**Flux paiement** : `pending` → (webhook succès) `escrow` → (date honoré ou clôturé) `released` ; ou `refund_pending` → `refunded` (annulation ≥ 3 h). Au moment de la libération : écritures `charge`, `commission` (10 %), `restaurant_share`, `provider_fee` dans `ledger`. Reversement hebdomadaire au restaurant via `payouts`.

### 3.14 Admin et modération

| Méthode | Route | Auth | Corps → Réponse |
|---|---|---|---|
| GET | `/admin/users?status=pending&q=` | A/M | → file de validation (matricule, photo, WhatsApp) |
| POST | `/admin/users/{id}/approve` | A/M | → `204` |
| POST | `/admin/users/{id}/reject` | A/M | `{ reason }` → `204` |
| POST | `/admin/users/{id}/suspend` | A/M | `{ reason, until? }` → `204` |
| POST | `/admin/users/{id}/ban` | A | `{ reason }` → `204` |
| POST | `/admin/users/{id}/unban` | A | → `204` |
| POST | `/admin/users/{id}/adjust-reliability` | A | `{ delta, reason }` → `204` |
| GET | `/admin/reports?status=open` | M/A | → file |
| POST | `/admin/reports/{id}/resolve` | M/A | `{ resolution, action?: "warn"\|"suspend"\|"ban"\|"none" }` → `204` |
| GET | `/admin/matches?status=disputed` | A | → litiges avec les deux rapports et preuves |
| POST | `/admin/matches/{id}/resolve` | A | `{ score_a, score_b, events: [] }` → `204` (appelle `admin_resolve_match`) |
| GET | `/admin/dates?status=disputed\|no_show` | A | → liste |
| POST | `/admin/dates/{id}/resolve` | A | `{ outcome: "refund_payer"\|"keep"\|"credit_partner", note }` → `204` |
| POST | `/admin/payments/{id}/refund` | A | `{ reason }` → `204` |
| GET | `/admin/stats?from=&to=` | A | → `{ users, active_weekly, matches, dates, revenue_fcfa, gender_ratio, reports }` |
| GET | `/admin/audit-log?actor=&action=` | A | → page |
| POST/PATCH/DELETE | `/admin/fields` | A | CRUD terrains |
| POST/PATCH | `/admin/restaurants` | A | création et commission |
| POST | `/admin/restaurants/{id}/staff` | A | `{ user_id }` → `204` |
| POST/PATCH | `/admin/badges`, `/admin/skills`, `/admin/filieres` | A | CRUD référentiels |
| POST | `/admin/broadcast` | A | `{ audience, title, body }` → `202` |

---

### 3.15 Services entre étudiants (Marketplace)

Légende supplémentaire : `prov` = prestataire de la commande · `cli` = client de la commande · `owner` = propriétaire de l'offre.

| Méthode | Route | Auth | Corps → Réponse | Erreurs |
|---|---|---|---|---|
| GET | `/services/categories` | U | → `[{ id, slug, name, parent_id }]` | |
| GET | `/services?q=&category=&min_price=&max_price=&delivery_mode=&sort=relevance\|rating\|price\|recent` | U | → page de `ServiceListing` (offres boostées en premier, recherche texte + sémantique) | |
| GET | `/services/recommended` | U | → offres proches de mes recherches et compétences | |
| POST | `/services` | U | `{ category_id, title, description, pricing, delivery_mode, location?, tags?, portfolio_upload_ids?, packages: [{ tier, name, description?, price_fcfa, delivery_days, revisions }] }` → `201 ServiceListing` (statut `draft`) | `PLAN_LIMIT_REACHED`, `LISTING_PROHIBITED`, `VALIDATION_ERROR` |
| GET | `/services/{id}` | U | → `ServiceListing` | `NOT_FOUND` |
| PATCH | `/services/{id}` | owner | champs modifiables → `ServiceListing` | `LISTING_PROHIBITED` |
| PUT | `/services/{id}/packages` | owner | `{ packages: [...] }` → `ServiceListing` (remplace les formules) | |
| PUT | `/services/{id}/availability` | owner | `{ slots: [{ starts_at, ends_at }] }` → `204` | |
| GET | `/services/{id}/availability?from=&to=` | U | → `[{ id, starts_at, ends_at, available }]` | |
| POST | `/services/{id}/submit` | owner | → `ServiceListing` (`active` si fiabilité ≥ 60 et catégorie non sensible, sinon `pending_review`) | `RELIABILITY_TOO_LOW`, `PLAN_LIMIT_REACHED` |
| POST | `/services/{id}/pause` | owner | → `204` | |
| POST | `/services/{id}/resume` | owner | → `204` | `PLAN_LIMIT_REACHED` |
| DELETE | `/services/{id}` | owner | → `204` (archive ; refusé s'il reste des commandes en cours) | `INVALID_STATE` |
| POST | `/services/{id}/boost` | owner | Header `Idempotency-Key` · `{ days: 3\|7, use_included?: true, provider?, phone_msisdn? }` → `201 { boost_until, payment? }` (consomme un boost inclus au plan si disponible, sinon paiement) | `DUPLICATE_REQUEST` |
| POST | `/services/{id}/favorite` | U | → `204` | |
| DELETE | `/services/{id}/favorite` | U | → `204` | |
| GET | `/me/favorites` | U | → page de `ServiceListing` | |
| GET | `/services/{id}/reviews` | U | → page d'avis | |
| POST | `/service-orders` | U | `{ listing_id, package_id?, slot_id?, requirements? }` → `201 ServiceOrder` (`requested`, commission fixée selon les droits du prestataire, fil de discussion créé) | `LISTING_NOT_ACTIVE`, `SELF_ORDER_FORBIDDEN`, `SLOT_ALREADY_BOOKED`, `ALREADY_BLOCKED` |
| GET | `/service-orders?role=client\|provider&status=` | U | → page de `ServiceOrder` | |
| GET | `/service-orders/{id}` | cli/prov | → `ServiceOrder` | `FORBIDDEN` |
| GET | `/service-orders/{id}/events` | cli/prov | → chronologie `[{ type, actor_id, at, meta }]` | |
| POST | `/service-orders/{id}/accept` | prov | → `ServiceOrder` (`accepted`) | `INVALID_STATE` |
| POST | `/service-orders/{id}/pay` | cli | Header `Idempotency-Key` · `{ provider: "mtn_momo"\|"orange_money", phone_msisdn }` → `201 Payment` (séquestre ; passage à `funded` à la réception de `payment.escrowed`) | `INVALID_STATE`, `DUPLICATE_REQUEST` |
| POST | `/service-orders/{id}/start` | prov | → `ServiceOrder` (`in_progress`) | `INVALID_STATE` |
| POST | `/service-orders/{id}/deliver` | prov | `{ note?, file_upload_ids? }` → `ServiceOrder` (`delivered`, validation automatique dans 72 h) | `INVALID_STATE` |
| POST | `/service-orders/{id}/request-revision` | cli | `{ reason }` → `ServiceOrder` | `REVISIONS_EXHAUSTED`, `INVALID_STATE` |
| POST | `/service-orders/{id}/complete` | cli | → `ServiceOrder` (`completed`, libération du séquestre moins la commission) | `INVALID_STATE` |
| POST | `/service-orders/{id}/cancel` | cli/prov | `{ reason? }` → `ServiceOrder` (client : avant paiement ; prestataire : jusqu'à la livraison, avec remboursement) | `INVALID_STATE` |
| POST | `/service-orders/{id}/dispute` | cli/prov | `{ reason, evidence_upload_ids? }` → `ServiceOrder` (`disputed`) | `INVALID_STATE` |
| POST | `/service-orders/{id}/review` | cli/prov | `{ rating: 1-5, comment? }` → `201` (commande terminée seulement) | `INVALID_STATE` |
| GET | `/me/seller-dashboard` | U | → `{ earnings_fcfa, pending_fcfa, completed, rating_avg, active_listings, listing_limit }` | |

**Règles**
- Les formules, délais et prix sont fixés par l'offre : pas de négociation par texte. Le chat de commande sert aux précisions ; option : chiffres et liens filtrés tant que la commande n'est pas payée.
- Les offres contenant un terme interdit (fraude académique) sont refusées à l'écriture (`LISTING_PROHIBITED`).
- La commission est fixée à la création de la commande et ne change plus (même si le plan du prestataire expire ensuite).

### 3.16 Abonnements et droits (Billing)

| Méthode | Route | Auth | Corps → Réponse | Erreurs |
|---|---|---|---|---|
| GET | `/plans?audience=` | U* | → `[Plan]` | |
| GET | `/me/entitlements` | U | → `Entitlements` de l'utilisateur | |
| GET | `/teams/{id}/entitlements` | C | → `Entitlements` de l'équipe | `NOT_CAPTAIN` |
| GET | `/partner-portal/entitlements` | P | → `Entitlements` du partenaire | |
| POST | `/promo-codes/validate` | U | `{ code, plan_code }` → `{ valid, percent_off, price_after_fcfa }` | `PROMO_INVALID` |
| POST | `/subscriptions` | U / C / PO | Header `Idempotency-Key` · `{ plan_code, subject_kind: "user"\|"team"\|"partner", subject_id, promo_code?, provider, phone_msisdn }` → `201 { subscription: Subscription, payment: Payment\|null }` (`payment: null` si montant 0 après promo : activation immédiate) | `PLAN_AUDIENCE_MISMATCH`, `PROMO_INVALID`, `NOT_CAPTAIN`, `FORBIDDEN`, `DUPLICATE_REQUEST` |
| GET | `/me/subscriptions` | U | → `[Subscription]` (utilisateur, et équipes dont je suis capitaine) | |
| POST | `/subscriptions/{id}/renew` | titulaire | Header `Idempotency-Key` · `{ provider, phone_msisdn }` → `201 Payment` (prolonge la période en cours, sans la perdre) | `INVALID_STATE`, `DUPLICATE_REQUEST` |
| POST | `/subscriptions/{id}/cancel` | titulaire | → `Subscription` (`cancel_at_period_end = true` ; les droits durent jusqu'à la fin de la période payée) | `INVALID_STATE` |
| POST | `/subscriptions/{id}/resume` | titulaire | → `Subscription` (annule l'arrêt programmé) | `INVALID_STATE` |
| GET | `/subscriptions/{id}/invoices` | titulaire | → `[{ id, period_start, period_end, amount_fcfa, discount_fcfa, status, paid_at }]` | |
| GET | `/invoices/{id}` | titulaire | → facture détaillée (téléchargeable en PDF) | |

**Cycle** : `pending_payment` → (paiement) `active` → (fin de période) `grace` 3 jours → `expired`. Un achat jamais payé expire au bout de 24 h. Rappels de renouvellement à J-7, J-3 et J-1. Rien n'est supprimé à l'expiration : les éléments au-delà de la limite sont mis en pause.

**Interne (non exposé par le Gateway)** : `GET /internal/entitlements/{subject_kind}/{subject_id}` → `{ entitlements }`, utilisé par Marketplace, Talents, Football et Partners (cache 60 s, purgé par `entitlements.changed`).

### 3.17 Partenariats (Partners)

#### Public (étudiants)

| Méthode | Route | Auth | Corps → Réponse | Erreurs |
|---|---|---|---|---|
| GET | `/partners?kind=&q=` | U | → page de `Organization` (actives seulement) | |
| GET | `/partners/{id}` | U | → `Organization` + offres actives | `NOT_FOUND` |
| GET | `/offers?partner_id=&kind=&q=&available=true` | U | → page de `Offer` | |
| GET | `/offers/{id}` | U | → `Offer` | `NOT_FOUND` |
| POST | `/offers/{id}/claim` | U | → `201 Voucher` | `OFFER_NOT_AVAILABLE`, `OFFER_SOLD_OUT`, `OFFER_LIMIT_REACHED`, `ENTITLEMENT_REQUIRED` |
| GET | `/me/vouchers?status=` | U | → `[Voucher]` (code et QR à présenter au commerçant) | |
| GET | `/sponsors?target_type=&target_id=` | U | → sponsors actifs d'une compétition, d'un événement ou d'une équipe (logo, nom) | |
| GET | `/ads/placements?slot=` | U | → `[AdPlacement]` diffusables maintenant | |
| POST | `/ads/placements/{id}/track` | U | `{ kind: "impression"\|"click" }` → `204` (limité en débit, une impression par session et par jour) | |
| POST | `/partners/apply` | U* | `{ kind, name, legal_name?, description, website?, contact_name, contact_whatsapp, contact_email, logo_upload_id? }` → `201 Organization` (statut `applied`, le demandeur devient `owner` à l'approbation) | `VALIDATION_ERROR` |

#### Portail partenaire (rôle `partner_staff`; `PO` = owner)

| Méthode | Route | Auth | Corps → Réponse | Erreurs |
|---|---|---|---|---|
| GET | `/partner-portal/organization` | P | → organisation et statut | |
| PATCH | `/partner-portal/organization` | PO | `{ description?, logo_upload_id?, website?, contact_* }` → `Organization` | |
| GET | `/partner-portal/agreement` | P | → contrat actif (ou en attente de signature) | |
| POST | `/partner-portal/agreements/{id}/sign` | PO | → `204` (statut `active`) | `INVALID_STATE` |
| GET | `/partner-portal/staff` | P | → `[{ user, role }]` | |
| POST | `/partner-portal/staff` | PO | `{ user_id, role }` → `204` | |
| DELETE | `/partner-portal/staff/{userId}` | PO | → `204` | |
| GET | `/partner-portal/offers?status=` | P | → `[Offer]` | |
| POST | `/partner-portal/offers` | P | `{ title, description?, kind, value?, conditions?, requires_entitlement?, stock?, per_user_limit?, valid_from?, valid_until? }` → `201 Offer` (`draft`) | `PLAN_LIMIT_REACHED`, `VALIDATION_ERROR` |
| PATCH | `/partner-portal/offers/{id}` | P | → `Offer` | |
| POST | `/partner-portal/offers/{id}/submit` | P | → `Offer` (`pending_review`) | `PLAN_LIMIT_REACHED` |
| POST | `/partner-portal/offers/{id}/pause` · `/resume` · `/end` | P | → `Offer` | `INVALID_STATE` |
| POST | `/partner-portal/vouchers/redeem` | P | `{ code }` → `{ offer_title, user: { first_name, photo_url } }` (le personnel vérifie l'identité visuellement) | `VOUCHER_INVALID`, `VOUCHER_ALREADY_USED`, `VOUCHER_EXPIRED`, `FORBIDDEN` |
| GET | `/partner-portal/vouchers?offer_id=&status=` | P | → bons réclamés et utilisés | |
| GET | `/partner-portal/sponsorship-packages` | P | → forfaits disponibles | |
| POST | `/partner-portal/deals` | PO | `{ package_id?, target_type, target_id?, amount_fcfa?, in_kind_value_fcfa?, starts_on, ends_on, deliverables? }` → `201 SponsorshipDeal` (`proposed`) | `VALIDATION_ERROR` |
| GET | `/partner-portal/deals` | P | → `[SponsorshipDeal]` | |
| POST | `/partner-portal/deals/{id}/accept` | PO | → `SponsorshipDeal` (`accepted` : accepte les conditions négociées) | `INVALID_STATE` |
| POST | `/partner-portal/deals/{id}/pay` | PO | Header `Idempotency-Key` · `{ provider, phone_msisdn }` → `201 Payment` (`paid` puis `active` au début de la période ; inutile si 100 % en nature) | `INVALID_STATE`, `DUPLICATE_REQUEST` |
| POST | `/partner-portal/assets` | P | `{ deal_id?, kind: "logo"\|"banner"\|"video", upload_id }` → `201` (en attente d'approbation) | |
| DELETE | `/partner-portal/assets/{id}` | P | → `204` | |
| POST | `/partner-portal/placements` | P | `{ asset_id, deal_id?, slot, starts_at, ends_at, max_impressions? }` → `201` (sans contrat de sponsoring : limité par le droit `ad_placements`) | `PLAN_LIMIT_REACHED`, `ASSET_NOT_APPROVED` |
| GET | `/partner-portal/stats?from=&to=` | P | → `{ vouchers_claimed, vouchers_redeemed, impressions, clicks, by_offer: [...], by_placement: [...] }` (nécessite `partner_analytics`) | `ENTITLEMENT_REQUIRED` |

**Cycle d'un sponsoring** : `proposed` → `negotiating` (l'admin ajuste prix et livrables) → `accepted` → `paid` → `active` → `completed` ; `cancelled` possible avant `active`.

**Restaurant** : les routes `/restaurant/*` de la section 3.9 sont inchangées pour les clients, mais elles sont maintenant servies par le service Partners. Un `restaurant_staff` est un membre du personnel d'une organisation de type `restaurant`, et `restaurant_id` correspond à un `venue_id`.

### 3.18 Fonctionnalités Pro (droits à vérifier)

| Fonction | Route | Droit (clé) | Gratuit par défaut | Erreur |
|---|---|---|---|---|
| Créer un événement | `POST /events` | `events_per_month` | 2 | `PLAN_LIMIT_REACHED` |
| Commission billets | `POST /events/{id}/tickets` | `ticket_commission_pct` | 8 % | n/a |
| Statistiques d'événement | `GET /events/{id}/analytics` → `{ views, registrations, tickets_sold, revenue_fcfa, checkin_rate }` | `event_analytics` | non | `ENTITLEMENT_REQUIRED` |
| Export des participants | `GET /events/{id}/attendees.csv` | `attendee_export` | non | `ENTITLEMENT_REQUIRED` |
| Offres de service actives | `POST /services`, `/services/{id}/resume` | `max_active_listings` | 3 | `PLAN_LIMIT_REACHED` |
| Commission services | `POST /service-orders` | `service_commission_pct` | 8 % | n/a |
| Boost inclus | `POST /services/{id}/boost`, `POST /posts/{id}/boost` | `boosts_per_month` | 0 | le boost devient payant |
| Page d'équipe | `GET /teams/{id}/page` | `team_page` | non | `ENTITLEMENT_REQUIRED` |
| Statistiques avancées d'équipe | `GET /teams/{id}/stats/advanced` | `advanced_stats` | non | `ENTITLEMENT_REQUIRED` |
| Offres partenaire actives | `POST /partner-portal/offers/{id}/submit` | `max_active_offers` | 1 | `PLAN_LIMIT_REACHED` |
| Statistiques partenaire | `GET /partner-portal/stats` | `partner_analytics` | non | `ENTITLEMENT_REQUIRED` |
| Vitrine sponsor (mise en avant dans `GET /sponsors`) | `GET /sponsors` | `sponsor_showcase` | non | n/a (tri prioritaire) |

Les erreurs de droits renvoient dans `details` : `{ "entitlement": "event_analytics", "required_plan": "ORGANIZER_PRO" }` pour permettre à la PWA d'afficher la bonne offre d'abonnement.

**Jamais soumis à un droit** : le classement Elo, les statistiques publiques de joueurs, le nombre de propositions de rencontre (3 par semaine) et l'accès aux dates. Un abonnement n'achète aucun avantage sportif ni de rencontre.

### 3.19 Administration : services, abonnements, partenariats

| Méthode | Route | Auth | Corps → Réponse |
|---|---|---|---|
| GET | `/admin/services?status=pending_review` | A/M | → offres à valider |
| POST | `/admin/services/{id}/approve` | A/M | → `204` |
| POST | `/admin/services/{id}/reject` | A/M | `{ reason }` → `204` |
| GET | `/admin/service-disputes?status=open` | A | → litiges (commande, preuves, historique) |
| POST | `/admin/service-disputes/{id}/resolve` | A | `{ resolution: "refund_client"\|"pay_provider"\|"split", split_client_pct? }` → `204` |
| GET/POST/PATCH | `/admin/service-categories` | A | CRUD catégories (catégories sensibles) |
| GET/POST/DELETE | `/admin/prohibited-terms` | A | gestion des termes interdits |
| GET/POST/PATCH | `/admin/plans` | A | CRUD plans et droits |
| GET/POST/PATCH | `/admin/free-entitlements` | A | droits du plan gratuit |
| POST | `/admin/entitlement-grants` | A | `{ subject_kind, subject_id, key, value, reason, expires_at? }` → `201` |
| DELETE | `/admin/entitlement-grants/{id}` | A | → `204` |
| GET/POST/PATCH | `/admin/promo-codes` | A | CRUD codes promo |
| GET | `/admin/subscriptions?status=&plan_code=` | A | → liste |
| GET | `/admin/billing/stats?from=&to=` | A | → `{ mrr_fcfa, active_by_plan, churn, renewals_rate }` |
| GET | `/admin/partners?status=applied\|under_review` | A | → candidatures |
| POST | `/admin/partners/{id}/review` | A | → `204` (`under_review`) |
| POST | `/admin/partners/{id}/approve` | A | `{ commission_pct? }` → `204` (le demandeur devient `owner`) |
| POST | `/admin/partners/{id}/reject` | A | `{ reason }` → `204` |
| POST | `/admin/partners/{id}/suspend` · `/reactivate` | A | `{ reason? }` → `204` |
| POST | `/admin/partners/{id}/agreements` | A | `{ terms, starts_on, ends_on?, document_upload_id? }` → `201` (nouvelle version) |
| POST | `/admin/agreements/{id}/send` · `/terminate` | A | → `204` |
| GET/POST/PATCH | `/admin/sponsorship-packages` | A | CRUD forfaits |
| GET | `/admin/deals?status=` | A | → sponsorings |
| POST | `/admin/deals` | A | même corps que `POST /partner-portal/deals` + `organization_id` → `201` (proposition de l'admin) |
| POST | `/admin/deals/{id}/negotiate` | A | `{ amount_fcfa?, in_kind_value_fcfa?, deliverables? }` → `204` (`negotiating`) |
| POST | `/admin/deals/{id}/cancel` | A | `{ reason }` → `204` |
| GET | `/admin/assets?approved=false` | A/M | → visuels à valider |
| POST | `/admin/assets/{id}/approve` · `/reject` | A/M | `{ reason? }` → `204` |
| GET | `/admin/offers?status=pending_review` | A/M | → offres à valider |
| POST | `/admin/offers/{id}/approve` · `/reject` · `/suspend` | A/M | `{ reason? }` → `204` |

---

## 4. Temps réel (service Realtime & Messaging, WebSocket)

| Canal | Abonnés | Événements |
|---|---|---|
| `user:{id}:notifications` | utilisateur | nouvelles notifications |
| `thread:{id}` | participants | nouveau message |
| `date:{id}` | les 2 convives | nouvelle carte, changement de statut, paiement, révélation du contact |
| `restaurant:{id}:dates` | staff | nouveau date confirmé, annulation (≥ 3 h), check-in, **alerte SOS** |
| `match:{id}` | joueurs des 2 équipes | rapport reçu, validation, litige |

## 5. Notifications (types)

`team.invite.received` · `team.join_request` · `match.challenge.received` · `match.scheduled` · `match.reminder.d1` · `match.reminder.h2` · `match.report.requested` · `match.validated` · `match.disputed` · `dating.picks.ready` · `dating.invite.received` · `dating.invite.accepted` · `date.slot.proposed` · `date.confirmed` · `date.reminder.d1` · `date.reminder.h3` · `date.cancelled` · `date.feedback.requested` · `date.contact.revealed` · `date.sos` · `payment.escrow` · `payment.refunded` · `post.application.received` · `mission.funded` · `mission.delivered` · `report.resolved` · `account.approved` · `account.suspended` · `service.order.requested` · `service.order.accepted` · `service.order.funded` · `service.order.delivered` · `service.order.completed` · `service.order.cancelled` · `service.order.disputed` · `service.listing.approved` · `service.listing.rejected` · `subscription.activated` · `subscription.renewal_reminder` · `subscription.grace_started` · `subscription.expired` · `partner.approved` · `partner.rejected` · `offer.approved` · `offer.rejected` · `voucher.redeemed` · `sponsorship.accepted` · `sponsorship.paid` · `sponsorship.activated` · `sponsorship.completed` · `asset.rejected`

## 6. Tâches planifiées (cron)

| Tâche | Fréquence (Africa/Douala) | Action |
|---|---|---|
| `generate_weekly_picks` | lundi 08:00 | 2 `similar` + 1 `complementary` via `match_candidates`, écrit `weekly_picks` |
| `expire_invites` | toutes les 15 min | passe en `expired` les invitations (date, équipe, défi) échues |
| `match_reminders` | toutes les 15 min | rappels J-1 / H-2 |
| `match_report_deadline` | toutes les 30 min | valide provisoirement la déclaration unique après 24 h |
| `date_reminders` | toutes les 10 min | rappels J-1 / H-3 |
| `close_expired_dates` | toutes les 10 min | absences, pénalités, libération du séquestre (fonction SQL) |
| `process_vector_updates` | toutes les 5 min | lit `vector_update_jobs`, applique la mise à jour de type Rocchio sur les embeddings |
| `refund_processor` | toutes les 5 min | exécute les `refund_pending` via le prestataire |
| `restaurant_payouts` | lundi 06:00 | calcule et envoie les reversements hebdomadaires |
| `award_badges` | quotidien 03:00 | évalue les badges (hat-trick, séries, Soulier d'or mensuel) |
| `cooldowns_cleanup` | quotidien 04:00 | purge `pair_cooldowns` échus |
| `expire_subscriptions` | toutes les heures | `billing.expire_subscriptions()` : active → grâce → expirée / annulée, abandon des achats non payés après 24 h |
| `subscription_reminders` | quotidien 09:00 | rappels de renouvellement à J-7, J-3 et J-1 |
| `auto_complete_orders` | toutes les 15 min | `marketplace.auto_complete_orders()` : validation automatique 72 h après livraison |
| `activate_due_deals` | quotidien 00:05 | `partners.activate_due_deals()` : démarre et clôt les sponsorings |
| `expire_offers_and_vouchers` | toutes les heures | `partners.expire_offers_and_vouchers()` : offres terminées, bons périmés |
| `pause_over_limit` | à chaque `entitlements.changed` | met en pause les offres de service et offres partenaires au-delà de la nouvelle limite |
| `outbox_publisher` | toutes les secondes (par service) | publie les lignes `outbox` non envoyées sur RabbitMQ |
| `monthly_quota_reset` | le 1er du mois 00:00 | remet à zéro les compteurs `boosts_per_month` et `events_per_month` |

## 7. Sécurité de l'API

- JWT court (1 h) + refresh ; RLS Postgres en seconde barrière.
- Les champs `whatsapp` et `matricule` ne sortent **jamais** d'un endpoint public ; le numéro d'un partenaire n'est servi que par `GET /dates/{id}/contact` après « oui » mutuel.
- Tous les envois de fichiers passent par URL signée (type et taille contrôlés) ; modération des photos avant publication.
- Webhooks paiement : vérification de signature, rejeu rejeté (`webhook_events` unique), traitement idempotent.
- Journal d'audit pour toute action admin et toute révélation de contact.
- CORS limité au domaine de la PWA ; CSP stricte ; HTTPS uniquement.

## 8. Versions et évolutions prévues

- v1.1 : dates de groupe (3+3), mode « on partage l'addition », plusieurs restaurants (`restaurant_id` déjà présent partout).
- v1.2 : boutique maillots, paris de pronostics sans argent. (L'abonnement Pro, les services entre étudiants et les partenariats ne sont plus en attente : ils sont dans la révision 2.)

## 9. Routage par microservice

Le client ne voit qu'une seule base d'URL. Le Gateway route par préfixe (voir `ARCHITECTURE.md`). Les routes `/internal/*` ne sont jamais routées.

| Préfixes | Service |
|---|---|
| `/auth`, `/me` (profil, fiabilité, blocages), `/users`, `/filieres`, `/reports`, `/uploads`, `/config`, `/admin/users`, `/admin/reports`, `/admin/audit-log` | Identity |
| `/teams`, `/team-invites`, `/fields`, `/challenges`, `/matches`, `/rankings`, `/players`, `/hall-of-fame`, `/competitions`, `/admin/matches`, `/admin/fields` | Football |
| `/dating`, `/dates`, `/admin/dates` | Dating |
| `/skills`, `/me/skills`, `/posts`, `/applications`, `/missions`, `/reviews`, `/meetups`, `/events` | Talents |
| `/services`, `/service-orders`, `/me/seller-dashboard`, `/me/favorites`, `/admin/services`, `/admin/service-*`, `/admin/prohibited-terms` | Marketplace |
| `/partners`, `/offers`, `/me/vouchers`, `/sponsors`, `/ads`, `/partner-portal`, `/restaurant`, `/restaurants`, `/admin/partners`, `/admin/agreements`, `/admin/sponsorship-packages`, `/admin/deals`, `/admin/assets`, `/admin/offers` | Partners |
| `/plans`, `/subscriptions`, `/invoices`, `/promo-codes`, `/me/entitlements`, `/me/subscriptions`, `/teams/{id}/entitlements`, `/admin/plans`, `/admin/free-entitlements`, `/admin/entitlement-grants`, `/admin/promo-codes`, `/admin/subscriptions`, `/admin/billing` | Billing |
| `/payments`, `/me/payments`, `/me/credits`, `/webhooks/payments`, `/admin/payments` | Payments |
| `/threads`, `/notifications`, `/me/push-subscriptions`, WebSocket `/realtime` | Realtime & Messaging |

Quand une route est « portée » par un autre service que celui du préfixe (exemple : `/teams/{id}/entitlements` est servi par Billing), le Gateway la déclare explicitement avant la règle générale du préfixe.

## 10. Historique des révisions

- **Révision 2** : ajout des services entre étudiants (§3.15), des abonnements et droits (§3.16), des partenariats et du portail partenaire (§3.17), du tableau des fonctions Pro (§3.18), de l'administration associée (§3.19), du routage par microservice (§9), des types de paiement `service_order`, `subscription`, `sponsorship`, et des nouveaux codes d'erreur. Le contrat n'utilise plus Supabase Auth ni Supabase Realtime : les JWT viennent du service Identity et le temps réel du service Realtime & Messaging.
- **Révision 1** : football, rencontres, projets, missions, événements, paiements, admin.
