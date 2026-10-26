# Domaine : uploads

Fichiers envoyés par les étudiants et les équipes : photo de profil, logo d’équipe, photos d’offre, portfolio, preuves de mission ou de match, reçu de date, bannière d’événement. Propriétaire : agent `platform` (service transverse, aucune règle métier de domaine).

## Pourquoi un service séparé

Les contrats v1 référençaient déjà des identifiants de fichiers (`photo_upload_id`, `logo_upload_id`, `file_upload_ids`, `evidence_upload_ids`) sans qu’aucune route ne permette de les créer. Ce service ferme ce trou : les autres domaines ne manipulent que des `upload_id` et ne voient jamais de binaire.

## Cycle de vie

1. `POST /uploads` déclare l’envoi (`purpose`, `content_type`, `byte_size`). Le service refuse **avant tout stockage** un type ou une taille hors règles, applique le quota quotidien (50 envois par compte) et crée un emplacement `pending` valable 24 h.
2. `PUT /uploads/{id}/content` envoie les octets bruts. Le `Content-Type` reçu doit être identique à celui déclaré ; la taille réelle est mesurée, jamais celle annoncée. Le fichier passe `ready` avec une empreinte SHA-256.
3. `POST /uploads/{id}/attach` rattache le fichier à un objet métier (`profile`, `team`, `listing`, `portfolio`, `mission`, `match`, `date`, `event`, `report`). Le plafond par objet dépend de l’usage (une photo de profil, six photos d’offre, douze pièces de portfolio…).
4. `DELETE /uploads/{id}` supprime le contenu et marque la ligne `deleted` ; les pièces jointes tombent en cascade.

## Règles appliquées

- **Type** : liste blanche par usage, jamais déduite du nom de fichier. Photos de profil, logos et bannières : `image/jpeg`, `image/png`, `image/webp`. Preuves, portfolios et reçus : ces trois types plus `application/pdf`.
- **Taille** : 2 Mio (logo), 5 Mio (photo de profil, photo d’offre, bannière), 10 Mio (portfolio, preuves, reçu). Refus → `UPLOAD_TOO_LARGE` (413), type refusé → `UPLOAD_TYPE_NOT_ALLOWED` (415). Ces deux codes étendent la liste d’`API.md` §1.
- **Propriété** : seul le compte propriétaire écrit, rattache ou supprime. Un autre compte reçoit `FORBIDDEN`.
- **Ordre** : on n’attache pas un emplacement vide (`INVALID_STATE`), on n’écrit pas deux fois le contenu d’un même emplacement.
- **Lecture** : `GET /uploads/{id}/content` est public — l’identifiant UUID est la capacité, comme une URL présignée. Réponse en cache immuable (`max-age=31536000`) avec `X-Content-Type-Options: nosniff`. Aucune route ne liste les fichiers d’un autre compte.
- **PII** : les fichiers peuvent contenir des données personnelles (photo, reçu). Aucune URL de lecture n’est devinable, et aucune métadonnée de fichier n’est journalisée en clair.

## Endpoints v1

`POST /uploads`, `PUT /uploads/{id}/content`, `GET /uploads/{id}`, `GET /uploads/{id}/content`, `POST /uploads/{id}/attach`, `DELETE /uploads/{id}`, `GET /files?object_type=&object_id=`, `GET /health`, `GET /ready`.

## Stockage

`StorageDriver` isole le binaire du service. Le pilote livré écrit dans `UPLOADS_STORAGE_DIR` (local, `.var/uploads`, hors dépôt) avec un chemin dérivé de l’UUID, jamais du nom fourni par le client. Un pilote S3-compatible (Cloudflare R2, Scaleway, MinIO) remplace `LocalDiskStorage` en production : c’est une décision d’hébergement, pas une modification du service. Le dossier local n’est pas sauvegardé et ne doit pas servir en production.

## Hors périmètre v1

Pilote S3 réel et URL présignées, analyse antivirus, redimensionnement et miniatures, transcodage vidéo, purge automatique des emplacements `pending` expirés (tâche planifiée à ajouter), modération a posteriori des images, quotas par plan.
