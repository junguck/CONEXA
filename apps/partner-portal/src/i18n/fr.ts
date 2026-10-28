/** Textes de la coquille du portail partenaire (l'interface est en français). */
export const fr = {
  appName: 'Convexa',
  appLabel: 'Portail partenaire',
  navLabel: 'Sections du portail',
  skipToContent: 'Aller au contenu',
  theme: 'Changer de thème',
  session: {
    loginTitle: 'Connexion requise',
    loginBody:
      'Le portail est réservé au personnel du restaurant. La connexion par rôle arrive avec le service Identity (F1.1).',
    pendingTitle: 'Compte en attente',
    pendingBody: 'L’équipe Convexa doit encore rattacher votre compte à un restaurant.',
    suspendedTitle: 'Compte suspendu',
    suspendedBody: 'Contactez votre référent Convexa pour rétablir l’accès.',
    forbiddenTitle: 'Accès refusé',
    forbiddenBody: 'Votre rôle ne permet pas d’ouvrir le portail partenaire.',
  },
} as const;
