# Juridique — Convexa

Ce dossier rassemble les documents juridiques que **seul un humain** peut produire
ou faire produire. Les agents n'y écrivent jamais de contenu contractuel : ils
listent ce qui manque, à qui cela incombe, et pourquoi c'est bloquant.

Statut : **vide par construction** — aucun document n'est encore fourni.

## Pourquoi ce dossier existe

Trois activités de Convexa ne sont pas de simples « conditions d'utilisation » :

1. **Détenir l'argent de tiers.** Un date ou une commande de service encaisse le
   client, garde les fonds sous séquestre, puis paie le prestataire en retenant
   une commission. Au Cameroun, cela peut relever de la réglementation des
   systèmes de paiement. Aucune mise en production n'est possible sans avis.
2. **Traiter des données personnelles de mineurs et d'étudiants** : numéro de
   téléphone, matricule, réponses à un questionnaire de personnalité, photos,
   historique de rencontres.
3. **Contracter avec des tiers** : l'école (accord et usage du matricule), les
   restaurants et prestataires (contrat de service et reversement), l'agrégateur
   de paiement (Campay), l'opérateur SMS.

## Ce qu'il faut fournir

### 1. Cadre du séquestre — `sequestre-avis-juriste.pdf`

Question à poser au juriste : *encaisser pour le compte d'un prestataire, conserver
les fonds sous séquestre et les revendre au prestataire après réalisation de la
prestation — est-ce un service de paiement soumis à agrément, ou un simple
mandat de collecte ?*

Décisions qui en découlent (voir [ADR 0008](../docs/decisions/0008-grand-livre-double-ecriture.md)) :

- la commission est-elle acquise à la **libération** des fonds ou dès
  l'**encaissement** ?
- qui supporte les **frais Campay** ?
- la **TVA** s'applique-t-elle à la commission ?
- durée de **conservation** du journal comptable.

### 2. Conditions générales — `cgu.pdf`, `cgv.pdf`

- CGU : règles de la plateforme, sanctions, signalement, litiges.
- CGV : prix, séquestre, annulation, remboursement, no-show, litige de match.
- **Règles de minorité** : à partir de quel âge un compte est autorisé, et sous
  quelle condition (autorisation parentale, restriction des rencontres).

### 3. Données personnelles — `registre-traitements.xlsx`, `politique-confidentialite.pdf`

Registre des traitements, base légale de chacun, durées de conservation,
sous-traitants (Campay, opérateur SMS, hébergeur), procédure d'export et
d'effacement. Le code prévoit déjà `deleted_at` / `anonymized_at` sur le profil ;
la **purge réelle** reste à décider (ADR 0003, point 3).

### 4. Accord de l'école — `accord-etablissement.pdf`

Usage du domaine `@…` et du matricule comme preuve d'inscription, conditions de
retrait de l'accord, responsabilité en cas de fraude au matricule.

### 5. Contrat prestataire — `contrat-prestataire-modele.pdf`

Rattachement à Convexa, prix, commission, délais, litiges, reversement sur numéro
Mobile Money **distinct du numéro WhatsApp**.

### 6. Contrats fournisseurs — `campay-contrat.pdf`, `mboasms-contrat.pdf`

Conditions d'utilisation, frais, responsabilité, niveau de service, traitement des
données. Les points techniques encore non confirmés sont listés dans
[docs/vendor/campay.md](../docs/vendor/campay.md) et
[docs/vendor/mboasms.md](../docs/vendor/mboasms.md).

### 7. Mentions légales — `mentions-legales.md`

Raison sociale, RCCM, NIU, siège, contact, hébergeur, responsable de publication.

## Règles de tenue

- Un fichier par document, nommé comme ci-dessus, dans ce dossier ou dans un
  sous-dossier daté (`2026-11/`).
- **Aucun secret** ici : ni clé d'API, ni mot de passe, ni donnée personnelle
  réelle. Les clés vivent dans `.env` en local et dans le gestionnaire de secrets
  en production.
- Ce dossier est **versionné** : il atteste de l'existence des documents, pas de
  leur validité juridique.
- Quand un document arrive, remplacer la ligne correspondante dans le tableau
  ci-dessous et retirer le blocage associé de
  [docs/STATUS.md](../docs/STATUS.md).

## Suivi

| Document | Fichier attendu | État | Bloque |
|---|---|---|---|
| Avis séquestre | `sequestre-avis-juriste.pdf` | manquant | F3.1 à F3.4 en production |
| CGU | `cgu.pdf` | manquant | ouverture publique |
| CGV | `cgv.pdf` | manquant | paiement réel |
| Registre RGPD | `registre-traitements.xlsx` | manquant | collecte réelle de données |
| Politique de confidentialité | `politique-confidentialite.pdf` | manquant | ouverture publique |
| Accord école | `accord-etablissement.pdf` | manquant | validation par matricule |
| Contrat prestataire | `contrat-prestataire-modele.pdf` | manquant | reversement réel |
| Contrat Campay | `campay-contrat.pdf` | manquant | encaissement réel |
| Contrat opérateur SMS | `mboasms-contrat.pdf` | manquant | envoi d'OTP en production |
| Mentions légales | `mentions-legales.md` | manquant | ouverture publique |
