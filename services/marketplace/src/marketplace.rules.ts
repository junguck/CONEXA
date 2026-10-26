import type { OrderStatus } from '@conexa/contracts';
import { AppError } from '@conexa/errors';

/** Fraude académique : ces formulations sont refusées à l'écriture (API.md §3.15). */
export const PROHIBITED_TERMS = [
  'faire ton devoir',
  'faire tes devoirs',
  'fais ton devoir',
  'fais tes devoirs',
  'faire mes devoirs',
  'examen a ta place',
  'passer ton examen',
  'passer tes examens',
  'corriger ton examen',
  'memoire cle en main',
  'these cle en main',
  'dissertation a ta place',
  'devoir note',
  'pendant l examen',
  'plagiat',
] as const;

export const AUTO_VALIDATE_HOURS = 72;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findProhibitedTerm(...parts: string[]): string | null {
  const haystack = normalize(parts.join(' '));
  return PROHIBITED_TERMS.find((term) => haystack.includes(term)) ?? null;
}

export function assertListingAllowed(...parts: string[]): void {
  const term = findProhibitedTerm(...parts);
  if (term) {
    throw new AppError('LISTING_PROHIBITED', 'Cette offre contient un terme interdit', { term });
  }
}

export interface Commission {
  commissionFcfa: number;
  netFcfa: number;
  pct: number;
}

/** Taux lu dans les droits du prestataire, puis figé sur la commande. */
export function commissionFor(amountFcfa: number, pct: number): Commission {
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
    throw new AppError('INTERNAL_ERROR', 'Taux de commission invalide');
  }
  const commissionFcfa = Math.round((amountFcfa * pct) / 100);
  return { commissionFcfa, netFcfa: amountFcfa - commissionFcfa, pct };
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  requested: ['accepted', 'cancelled'],
  accepted: ['funded', 'cancelled'],
  funded: ['in_progress', 'cancelled', 'disputed'],
  in_progress: ['delivered', 'cancelled', 'disputed'],
  delivered: ['completed', 'disputed', 'in_progress'],
  completed: [],
  cancelled: [],
  disputed: ['completed', 'cancelled'],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new AppError('INVALID_STATE', `Commande ${from} → ${to} interdite`);
  }
}

export function assertRevisionAllowed(input: {
  status: OrderStatus;
  used: number;
  limit: number;
}): void {
  if (input.status !== 'delivered') {
    throw new AppError('INVALID_STATE', 'La révision ne s’applique qu’à une livraison');
  }
  if (input.used >= input.limit) {
    throw new AppError('REVISIONS_EXHAUSTED', 'Toutes les révisions de la formule sont utilisées');
  }
}

export function autoValidateAt(deliveredAt: Date): Date {
  return new Date(deliveredAt.getTime() + AUTO_VALIDATE_HOURS * 60 * 60 * 1000);
}
