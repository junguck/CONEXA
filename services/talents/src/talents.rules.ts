import type { MissionStatus } from '@conexa/contracts';
import { AppError } from '@conexa/errors';

export const MIN_MISSION_AMOUNT = 500;

export interface Commission {
  commissionFcfa: number;
  netFcfa: number;
  pct: number;
}

/** Le taux vient du portefeuille de droits ; on n'arrondit qu'à la fin. */
export function commissionFor(amountFcfa: number, pct: number): Commission {
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
    throw new AppError('INTERNAL_ERROR', 'Taux de commission invalide');
  }
  const commissionFcfa = Math.round((amountFcfa * pct) / 100);
  return { commissionFcfa, netFcfa: amountFcfa - commissionFcfa, pct };
}

const TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  proposed: ['accepted', 'cancelled'],
  accepted: ['funded', 'cancelled'],
  funded: ['delivered', 'disputed', 'cancelled'],
  delivered: ['approved', 'disputed'],
  approved: [],
  disputed: ['approved', 'cancelled'],
  cancelled: [],
};

export function canTransitionMission(from: MissionStatus, to: MissionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertMissionTransition(from: MissionStatus, to: MissionStatus): void {
  if (!canTransitionMission(from, to)) {
    throw new AppError('INVALID_STATE', `Mission ${from} → ${to} interdite`);
  }
}

/** Une mission ne peut être livrée qu'une fois le séquestre financé. */
export function assertFunded(status: MissionStatus): void {
  if (status !== 'funded') {
    throw new AppError('INVALID_STATE', 'La mission doit être financée avant cette étape');
  }
}

export function assertDelivered(status: MissionStatus): void {
  if (status !== 'delivered') {
    throw new AppError('INVALID_STATE', 'Le prestataire doit d’abord livrer');
  }
}

/** Un avis n'existe qu'après approbation, et seulement par un participant. */
export function assertCanReview(input: {
  status: MissionStatus;
  authorId: string;
  clientId: string;
  providerId: string;
}): string {
  if (input.status !== 'approved') {
    throw new AppError('INVALID_STATE', 'L’avis ouvre après une mission terminée');
  }
  if (input.authorId === input.clientId) {
    return input.providerId;
  }
  if (input.authorId === input.providerId) {
    return input.clientId;
  }
  throw new AppError('FORBIDDEN', 'Seuls le client et le prestataire notent cette mission');
}
