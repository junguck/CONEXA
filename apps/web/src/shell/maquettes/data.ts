/**
 * Données fictives des maquettes (DESIGN_HANDOFF.md §7). Aucun appel réseau :
 * les agents de domaine remplaceront ces constantes par leurs contrats.
 */

export const me = {
  firstName: 'Brice',
  fullName: 'Brice Junguck',
  filiere: 'Génie Civil',
  level: 'L3',
  initials: 'BJ',
};

export const matches = [
  {
    home: 'Info Lions',
    away: 'Droit United',
    homeCode: 'IL',
    awayCode: 'DU',
    scoreHome: 2,
    scoreAway: 1,
    time: "67'",
    live: true,
  },
  {
    home: 'Génie Civil',
    away: 'Lettres FC',
    homeCode: 'GC',
    awayCode: 'LF',
    scoreHome: null,
    scoreAway: null,
    time: '16:00',
    live: false,
  },
  {
    home: 'Gestion Kings',
    away: 'Médecine',
    homeCode: 'GK',
    awayCode: 'MD',
    scoreHome: null,
    scoreAway: null,
    time: '18:00',
    live: false,
  },
  {
    home: 'Sciences Éco',
    away: 'Archi Crew',
    homeCode: 'SE',
    awayCode: 'AC',
    scoreHome: 3,
    scoreAway: 3,
    time: 'FT',
    live: false,
  },
];

export const standings = [
  {
    rank: 1,
    team: 'Info Lions',
    code: 'IL',
    played: 6,
    won: 5,
    drawn: 1,
    lost: 0,
    goals: '+12',
    points: 16,
  },
  {
    rank: 2,
    team: 'Génie Civil',
    code: 'GC',
    played: 6,
    won: 4,
    drawn: 1,
    lost: 1,
    goals: '+7',
    points: 13,
  },
  {
    rank: 3,
    team: 'Droit United',
    code: 'DU',
    played: 6,
    won: 3,
    drawn: 1,
    lost: 2,
    goals: '+2',
    points: 10,
  },
  {
    rank: 4,
    team: 'Sciences Éco',
    code: 'SE',
    played: 6,
    won: 2,
    drawn: 2,
    lost: 2,
    goals: '0',
    points: 8,
  },
  {
    rank: 5,
    team: 'Archi Crew',
    code: 'AC',
    played: 6,
    won: 1,
    drawn: 1,
    lost: 4,
    goals: '−5',
    points: 4,
  },
];

export const picks = [
  {
    name: 'Mireille',
    age: 21,
    filiere: 'Gestion',
    level: 'L3',
    distance: '350 m',
    traits: ['Cuisine', 'Football', 'Voyages'],
    compatibility: '87 % compatibles',
    variant: 1 as const,
  },
  {
    name: 'Aïcha',
    age: 22,
    filiere: 'Design',
    level: 'L2',
    distance: '1,2 km',
    traits: ['Illustration', 'Café', 'Musique'],
    compatibility: '81 % compatibles',
    variant: 3 as const,
  },
  {
    name: 'Nadia',
    age: 20,
    filiere: 'Droit',
    level: 'L1',
    distance: '2 km',
    traits: ['Lecture', 'Bénévolat', 'Cuisine'],
    compatibility: '76 % compatibles',
    variant: 2 as const,
  },
];

export const chatSeed = [
  {
    id: 'm1',
    from: 'peer' as const,
    text: 'Salut ! Ravie qu’on se soit trouvés. Tu connais déjà le restaurant ?',
    at: '18:02',
  },
  {
    id: 'm2',
    from: 'me' as const,
    text: 'Pas encore, mais le menu du bistrot a l’air bien. On se retrouve devant l’entrée ?',
    at: '18:04',
  },
  {
    id: 'm3',
    from: 'peer' as const,
    text: 'Parfait. Je serai là un peu avant, avec une veste verte.',
    at: '18:05',
  },
];

export const payments = [
  {
    id: 'pay-4821',
    reference: 'CVX-4821',
    label: 'Date · Le Bistrot du Campus',
    when: 'Dimanche 16:00',
    amount: '8 000 FCFA',
    state: 'En séquestre' as const,
    detail: 'Libéré après le date, ou remboursé si annulation à plus de 3 h.',
  },
  {
    id: 'pay-4790',
    reference: 'CVX-4790',
    label: 'Service · Soutien analyse',
    when: '23 oct.',
    amount: '2 100 FCFA',
    state: 'Versé' as const,
    detail: 'Prestation confirmée par les deux parties.',
  },
  {
    id: 'pay-4742',
    reference: 'CVX-4742',
    label: 'Date · Chez Tantie',
    when: '21 oct.',
    amount: '15 000 FCFA',
    state: 'Remboursé' as const,
    detail: 'Annulation par le restaurant, remboursement sous 48 h.',
  },
];

export const operators = [
  { id: 'mtn', label: 'MTN MoMo', hint: 'Code de confirmation sur ton téléphone' },
  { id: 'orange', label: 'Orange Money', hint: 'Validation dans l’application Orange' },
];

export const dates = [
  {
    name: 'Mireille',
    restaurant: 'Le Bistrot du Campus',
    when: 'Dimanche 16:00',
    status: 'En attente de paiement',
    amount: '8 000 FCFA',
    variant: 1 as const,
  },
  {
    name: 'Aïcha',
    restaurant: 'Chez Tantie',
    when: 'Samedi 19:30',
    status: 'Confirmé',
    amount: '7 000 FCFA',
    variant: 2 as const,
  },
];

export const posts = [
  {
    author: 'Léa N.',
    headline: 'Mathématiques · L2 · Tutrice vérifiée',
    initials: 'LN',
    time: '2 h',
    tag: 'Réseau',
    body: 'Je cherche 2 développeurs back-end et 1 designer pour le hackathon de novembre. Projet : covoiturage entre étudiants.',
    hashtags: ['#hackathon', '#NestJS', '#Figma'],
    reactions: 24,
    comments: 6,
  },
  {
    author: 'Convexa Missions',
    headline: 'Mission proposée · budget 25 000 XAF',
    initials: 'CX',
    time: '5 h',
    tag: 'Mission',
    body: 'Refonte de l’affiche du gala de la filière Gestion. Livraison en 3 jours, révisions incluses.',
    hashtags: ['#design', '#gala'],
    reactions: 12,
    comments: 3,
  },
];

export const notifications = [
  {
    title: 'Info Lions a validé le score',
    body: 'Le match Info Lions 2 – 1 Droit United est confirmé.',
    time: 'Il y a 12 min',
    unread: true,
  },
  {
    title: 'Nouvelle proposition Meet',
    body: 'Mireille, 21 ans, Gestion L3 — 87 % compatible.',
    time: 'Il y a 1 h',
    unread: true,
  },
  {
    title: 'Invitation réseau',
    body: 'Léa N. souhaite rejoindre ton réseau Pro.',
    time: 'Hier',
    unread: false,
  },
  {
    title: 'Paiement reçu',
    body: '8 000 FCFA placés en séquestre pour le date de dimanche.',
    time: 'Hier',
    unread: false,
  },
];

export const network = [
  { name: 'Léa N.', headline: 'Mathématiques · L2 · Tutrice', initials: 'LN', mutual: 4 },
  { name: 'Samuel M.', headline: 'Génie Civil · L3 · Chef de projet', initials: 'SM', mutual: 2 },
  { name: 'Aïcha K.', headline: 'Design · L2 · Freelance', initials: 'AK', mutual: 7 },
];

export const jobs = [
  {
    title: 'Développeur back-end NestJS',
    org: 'Covoit’Campus',
    budget: '25 000 XAF',
    deadline: '3 jours',
    tags: ['NestJS', 'PostgreSQL'],
  },
  {
    title: 'Designer d’affiche',
    org: 'Gala Gestion',
    budget: '15 000 XAF',
    deadline: '5 jours',
    tags: ['Figma', 'Print'],
  },
  {
    title: 'Tuteur en analyse',
    org: 'Département Maths',
    budget: '8 000 XAF / séance',
    deadline: 'Cette semaine',
    tags: ['Analyse', 'L1'],
  },
];

export const teamRequests = [
  {
    id: 'tr1',
    name: 'Yannick K.',
    position: 'Défenseur',
    level: 'M1 Informatique',
    note: '2 saisons en championnat inter-filières.',
  },
  {
    id: 'tr2',
    name: 'Nadia B.',
    position: 'Attaquante',
    level: 'L1 Droit',
    note: 'Débutante, disponible le week-end.',
  },
];

export const squad = [
  { number: 1, name: 'Kevin T.', role: 'Gardien', available: true },
  { number: 4, name: 'Samuel M.', role: 'Défenseur', available: true },
  { number: 8, name: 'Brice J.', role: 'Milieu', available: false },
  { number: 9, name: 'Aïcha K.', role: 'Attaquante', available: true },
  { number: 11, name: 'Léa N.', role: 'Milieu', available: true },
];

export const playerStats = [
  { name: 'Aïcha K.', goals: 7, assists: 3, matches: 6, mvp: 2 },
  { name: 'Brice J.', goals: 4, assists: 5, matches: 6, mvp: 1 },
  { name: 'Samuel M.', goals: 1, assists: 2, matches: 5, mvp: 0 },
  { name: 'Kevin T.', goals: 0, assists: 0, matches: 6, mvp: 1 },
];

export const competitions = [
  {
    id: 'ligue',
    name: 'Ligue Inter-filières',
    format: 'Poules · 2 matchs restants',
    state: 'En cours',
  },
  {
    id: 'coupe',
    name: 'Coupe du Campus',
    format: 'Élimination directe · 8 équipes',
    state: 'Quarts',
  },
];

export const bracket = [
  { round: 'Quarts', home: 'Info Lions', away: 'Lettres FC', score: '4 – 1' },
  { round: 'Quarts', home: 'Polytech', away: 'Droit United', score: '0 – 0' },
  { round: 'Demi', home: 'Info Lions', away: 'À déterminer', score: '—' },
];

export const proThreads = [
  {
    id: 'th1',
    name: 'Léa N.',
    headline: 'Mathématiques · L2',
    last: 'Parfait, je t’envoie le brief.',
    unread: 2,
  },
  {
    id: 'th2',
    name: 'Samuel M.',
    headline: 'Génie Civil · L3',
    last: 'Merci pour la reco !',
    unread: 0,
  },
  {
    id: 'th3',
    name: 'Covoit’Campus',
    headline: 'Mission · back-end',
    last: 'On peut en parler demain.',
    unread: 1,
  },
];

export const proConversation = [
  {
    id: 'p1',
    from: 'peer' as const,
    text: 'Salut Brice ! Ton profil correspond bien à la mission back-end.',
    at: '09:12',
  },
  {
    id: 'p2',
    from: 'me' as const,
    text: 'Merci ! Je peux livrer le module en deux semaines.',
    at: '09:15',
  },
  { id: 'p3', from: 'peer' as const, text: 'Parfait, je t’envoie le brief.', at: '09:16' },
];

export const proInvitations = [
  { id: 'inv1', name: 'Léa N.', headline: 'Mathématiques · L2 · Tutrice vérifiée', mutual: 4 },
  { id: 'inv2', name: 'Samuel M.', headline: 'Génie Civil · L3 · Chef de projet', mutual: 2 },
];

export const proSuggestions = [
  { id: 's1', name: 'Aïcha K.', headline: 'Design · L2 · Freelance', mutual: 7 },
  { id: 's2', name: 'Yannick K.', headline: 'Informatique · M1 · Back-end', mutual: 3 },
  { id: 's3', name: 'Nadia B.', headline: 'Droit · L1 · Événementiel', mutual: 1 },
];

export const proSkills = ['NestJS', 'PostgreSQL', 'AutoCAD', 'Gestion de chantier'];

export const partnerOffers = [
  {
    id: 'of1',
    title: 'Menu duo',
    price: '7 750',
    active: true,
    note: '2 personnes, boissons incluses',
  },
  {
    id: 'of2',
    title: 'Formule déjeuner',
    price: '4 500',
    active: true,
    note: 'Plat + boisson, du lundi au vendredi',
  },
  {
    id: 'of3',
    title: 'Dessert offert',
    price: '0',
    active: false,
    note: 'Offre de bienvenue, 1 par compte',
  },
];

export const payouts = [
  { id: 'po1', reference: 'REV-0924', period: '18 – 24 oct.', amount: '186 000', state: 'Versé' },
  { id: 'po2', reference: 'REV-0917', period: '11 – 17 oct.', amount: '154 000', state: 'Versé' },
  {
    id: 'po3',
    reference: 'REV-0924',
    period: '25 – 31 oct.',
    amount: '42 000',
    state: 'En attente',
  },
];

export const staff = [
  { id: 'st1', name: 'Mama Têté', role: 'Propriétaire', email: 'direction@…' },
  { id: 'st2', name: 'Clarisse M.', role: 'Salle', email: 'clarisse@…' },
  { id: 'st3', name: 'Serge T.', role: 'Cuisine', email: 'serge@…' },
];

export const moderationQueue = [
  {
    id: 'mo1',
    author: 'Kevin T.',
    excerpt: 'Vends 3 places pour le gala, prix à débattre…',
    reason: 'Vente non autorisée',
    age: '12 min',
  },
  {
    id: 'mo2',
    author: 'Inconnu',
    excerpt: 'Contacte-moi vite pour un prêt garanti…',
    reason: 'Signalement ×3',
    age: '40 min',
  },
  {
    id: 'mo3',
    author: 'Yannick K.',
    excerpt: 'Photo de terrain sans autorisation',
    reason: 'Droit à l’image',
    age: '2 h',
  },
];

export const partnerApplications = [
  {
    id: 'ap1',
    name: 'Chez Tantie',
    area: 'Bonapriso',
    menu: 'Cuisine camerounaise',
    docs: 'Registre fourni',
    state: 'pending',
  },
  {
    id: 'ap2',
    name: 'Le Bistrot du Campus',
    area: 'Akwa',
    menu: 'Franco-camerounaise',
    docs: 'À compléter',
    state: 'pending',
  },
  {
    id: 'ap3',
    name: 'Snack Express',
    area: 'Bonabéri',
    menu: 'Fast-food',
    docs: 'Registre fourni',
    state: 'refused',
  },
];

export const auditLog = [
  {
    id: 'au1',
    at: '24 oct. 18:42',
    actor: 'moderator · bjunguck',
    action: 'Compte validé',
    target: 'Mireille B.',
  },
  {
    id: 'au2',
    at: '24 oct. 18:10',
    actor: 'moderator · bjunguck',
    action: 'Litige tranché',
    target: 'Info Lions / Génie Civil',
  },
  {
    id: 'au3',
    at: '24 oct. 17:05',
    actor: 'admin · system',
    action: 'Partenaire validé',
    target: 'Chez Tantie',
  },
  {
    id: 'au4',
    at: '23 oct. 21:37',
    actor: 'moderator · aicha',
    action: 'Publication masquée',
    target: 'Kevin T.',
  },
];
