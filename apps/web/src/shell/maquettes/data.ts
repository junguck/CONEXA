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
