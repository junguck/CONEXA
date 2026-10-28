/** Textes de la coquille du back-office (l'interface est en français). */
export const fr = {
  appName: 'Convexa',
  appLabel: 'Back-office',
  navLabel: 'Sections du back-office',
  skipToContent: 'Aller au contenu',
  theme: 'Changer de thème',
  session: {
    loginTitle: 'Connexion requise',
    loginBody:
      'Cet espace est réservé à l’équipe de modération. La connexion par rôle arrive avec le service Identity (F1.1).',
    pendingTitle: 'Compte en attente',
    pendingBody: 'Un administrateur doit encore valider votre compte.',
    suspendedTitle: 'Compte suspendu',
    suspendedBody: 'Contactez le support du campus pour rétablir votre accès.',
    forbiddenTitle: 'Accès refusé',
    forbiddenBody: 'Votre rôle ne permet pas d’ouvrir le back-office.',
  },
} as const;
