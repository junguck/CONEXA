/**
 * Données fictives de la maquette Portal (DESIGN_HANDOFF.md §7). Le portail ne
 * montre jamais de numéro WhatsApp ni de matricule : prénom et code seulement.
 */

export interface Reservation {
  id: string;
  time: string;
  code: string;
  firstName: string;
  covers: number;
  arrived: boolean;
}

export const TONIGHT: Reservation[] = [
  { id: 'r1', time: '19:30', code: 'CVX-4821', firstName: 'Mireille', covers: 2, arrived: false },
  { id: 'r2', time: '20:00', code: 'CVX-4830', firstName: 'Yannick', covers: 2, arrived: false },
  { id: 'r3', time: '20:30', code: 'CVX-4835', firstName: 'Aïcha', covers: 2, arrived: false },
];

export const TONIGHT_STATS = {
  reservations: 6,
  coversThisWeek: 38,
  payout: '240 000',
} as const;

export interface MenuDuo {
  name: string;
  description: string;
  price: string;
}

export const MENU_DUO: MenuDuo = {
  name: 'Menu duo',
  description:
    'Entrée, plat, dessert et deux boissons. Prix affiché par personne, service compris.',
  price: '7 750',
};

export interface ServiceSlot {
  id: string;
  label: string;
  window: string;
  covers: number;
  open: boolean;
}

export const SERVICE_SLOTS: ServiceSlot[] = [
  { id: 'midi-1', label: 'Midi', window: '12:00 – 13:30', covers: 12, open: true },
  { id: 'midi-2', label: 'Midi tardif', window: '13:30 – 15:00', covers: 8, open: true },
  { id: 'soir-1', label: 'Soir', window: '19:00 – 20:30', covers: 16, open: true },
  { id: 'soir-2', label: 'Soir tardif', window: '20:30 – 22:00', covers: 10, open: false },
];
