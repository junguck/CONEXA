/**
 * Données fictives des écrans de la maquette (DESIGN_HANDOFF.md §7). Aucune
 * règle métier ici : les contrats et les décisions viennent du serveur.
 */

export interface AccountRequest {
  id: string;
  name: string;
  program: string;
  level: string;
  document: { label: string; tone: 'ok' | 'warn' | 'bad' };
  received: string;
  state: 'pending' | 'refused';
}

export const ACCOUNT_REQUESTS: AccountRequest[] = [
  {
    id: 'acc-1',
    name: 'Mireille B.',
    program: 'Gestion',
    level: 'L3',
    document: { label: 'Carte lisible', tone: 'ok' },
    received: 'il y a 10 min',
    state: 'pending',
  },
  {
    id: 'acc-2',
    name: 'Yannick K.',
    program: 'Informatique',
    level: 'M1',
    document: { label: 'Photo floue', tone: 'warn' },
    received: 'il y a 42 min',
    state: 'pending',
  },
  {
    id: 'acc-3',
    name: 'Aïcha M.',
    program: 'Droit',
    level: 'L2',
    document: { label: 'Carte lisible', tone: 'ok' },
    received: 'il y a 2 h',
    state: 'pending',
  },
  {
    id: 'acc-4',
    name: 'Kevin T.',
    program: 'Médecine',
    level: 'L1',
    document: { label: 'Nom différent', tone: 'bad' },
    received: 'il y a 3 h',
    state: 'refused',
  },
];

export interface Dispute {
  id: string;
  kind: 'Score contesté' | 'Prestation non réalisée' | 'Signalement comportement';
  title: string;
  context: string;
  age: string;
  urgent: boolean;
  declarations: [string, string] | null;
  blockedAmount?: string;
  note: string;
}

export const DISPUTES: Dispute[] = [
  {
    id: 'disp-1',
    kind: 'Score contesté',
    title: 'Info Lions / Génie Civil',
    context: 'Football · 3-2 contre 2-3',
    age: 'Ouvert depuis 6 h',
    urgent: false,
    declarations: ['3 – 2', '2 – 3'],
    note: 'Aucune preuve jointe. Les deux capitaines ont 48 h pour ajouter une photo du tableau ou un témoin.',
  },
  {
    id: 'disp-2',
    kind: 'Prestation non réalisée',
    title: 'Soutien analyse',
    context: 'Services · 2 100 XAF bloqués',
    age: 'Ouvert depuis 1 j',
    urgent: false,
    declarations: null,
    blockedAmount: '2 100 XAF',
    note: 'Le client déclare que la séance n’a pas eu lieu. Le prestataire doit répondre sous 48 h.',
  },
  {
    id: 'disp-3',
    kind: 'Signalement comportement',
    title: 'Signalement Meet',
    context: 'Meet · message hors charte',
    age: 'Ouvert depuis 2 h',
    urgent: true,
    declarations: null,
    note: 'Le message est masqué en attendant la décision. Le compte signalé garde ses accès jusqu’à la revue.',
  },
];

export interface LedgerEntry {
  id: string;
  reference: string;
  type: string;
  amount: string;
  state: 'Bloqué' | 'Versé' | 'Encaissé' | 'Remboursé';
  month: 'octobre' | 'septembre';
  date: string;
}

export const LEDGER: LedgerEntry[] = [
  {
    id: 'l1',
    reference: 'CVX-4821',
    type: 'Repas Meet',
    amount: '15 500',
    state: 'Bloqué',
    month: 'octobre',
    date: '24 oct.',
  },
  {
    id: 'l2',
    reference: 'CVX-4790',
    type: 'Service entre étudiants',
    amount: '2 100',
    state: 'Versé',
    month: 'octobre',
    date: '23 oct.',
  },
  {
    id: 'l3',
    reference: 'CVX-4766',
    type: 'Abonnement Pro',
    amount: '2 500',
    state: 'Encaissé',
    month: 'octobre',
    date: '22 oct.',
  },
  {
    id: 'l4',
    reference: 'CVX-4742',
    type: 'Repas Meet',
    amount: '15 000',
    state: 'Remboursé',
    month: 'octobre',
    date: '21 oct.',
  },
  {
    id: 'l5',
    reference: 'CVX-4611',
    type: 'Repas Meet',
    amount: '14 500',
    state: 'Versé',
    month: 'septembre',
    date: '28 sept.',
  },
  {
    id: 'l6',
    reference: 'CVX-4588',
    type: 'Service entre étudiants',
    amount: '3 000',
    state: 'Versé',
    month: 'septembre',
    date: '24 sept.',
  },
];

export const LEDGER_TOTALS = {
  octobre: { collected: '1 284 500', escrow: '236 000', paidOut: '912 000', refunded: '48 500' },
  septembre: { collected: '1 102 000', escrow: '184 000', paidOut: '861 000', refunded: '31 000' },
} as const;
