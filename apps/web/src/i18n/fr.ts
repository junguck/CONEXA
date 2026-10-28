/**
 * Textes de l'interface en français (AGENTS.md : l'interface est en français,
 * les identifiants et le code en anglais). Les écrans de domaine ajoutent leurs
 * propres clés dans leur dossier `features/<domaine>/messages.ts`.
 */
export const fr = {
  appName: 'Convexa',
  skipToContent: 'Aller au contenu',
  nav: {
    football: 'Foot',
    meet: 'Meet',
    home: 'CXA',
    pro: 'Pro',
    me: 'Moi',
    primaryLabel: 'Navigation principale',
  },
  actions: {
    theme: 'Changer de thème',
    close: 'Fermer',
    retry: 'Réessayer',
    loading: 'Chargement',
  },
  home: {
    title: 'Le campus en un geste',
    subtitle: 'Foot, rencontres, talents et services : tout part d’ici.',
    modulesTitle: 'Modules',
    modulesEmpty: 'Aucun module n’est encore branché. Ajoutez un fichier dans src/features.',
    designLink: 'Voir le design system',
    comingSoon:
      'Ce module arrive bientôt. En attendant, la coquille et le design system sont prêts.',
  },
  design: {
    title: 'Design system',
    subtitle: 'Jetons, composants et états de base, dans l’univers actif.',
    buttons: 'Boutons',
    fields: 'Champs',
    feedback: 'Retours utilisateur',
    data: 'Données',
    dialog: 'Ouvrir une boîte de dialogue',
    dialogTitle: 'Confirmer le paiement',
    dialogBody: '8 000 FCFA seront débités. Annulation gratuite jusqu’à 3 h avant le date.',
    dialogFooter: 'Payer',
    sheet: 'Ouvrir un panneau',
    sheetTitle: 'Choisir une formule',
    toast: 'Afficher un message',
    toastTitle: 'Paiement en attente',
    toastBody: 'Confirmez sur votre téléphone (MTN ou Orange).',
    emptyTitle: 'Aucun match cette semaine',
    emptyBody: 'Les matchs apparaissent dès qu’une équipe vous défie.',
  },
  auth: {
    loginTitle: 'Connexion requise',
    loginBody: 'Connectez-vous pour accéder à cet écran.',
    loginAction: 'Se connecter',
    pendingTitle: 'Compte en attente',
    pendingBody: 'Un administrateur doit encore valider votre compte.',
    suspendedTitle: 'Compte suspendu',
    suspendedBody: 'Contactez le support du campus pour rétablir votre accès.',
    forbiddenTitle: 'Accès refusé',
    forbiddenBody: 'Votre rôle ne permet pas d’ouvrir cet écran.',
  },
  offline: {
    title: 'Hors connexion',
    body: 'Vous êtes hors ligne. Les pages déjà visitées restent accessibles ; le reste revient au retour du réseau.',
    retry: 'Réessayer',
  },
  update: {
    title: 'Nouvelle version disponible',
    body: 'Rechargez pour profiter des dernières corrections.',
    action: 'Recharger',
  },
} as const;

export type Dictionary = typeof fr;
