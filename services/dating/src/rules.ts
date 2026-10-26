import type { DateStatus, Eligibility, EligibilityReason } from '@conexa/contracts';
import { INVITES_PER_WEEK, MIN_AGE, PICKS_PER_WEEK, RELIABILITY_MIN } from '@conexa/contracts';
import { AppError } from '@conexa/errors';

export { INVITES_PER_WEEK, PICKS_PER_WEEK, RELIABILITY_MIN };

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export const CANCEL_WINDOW_HOURS = 3;

export function ageAt(birthDate: Date, now: Date): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) {
    age -= 1;
  }
  return age;
}

export function isAdult(birthDate: Date, now: Date): boolean {
  return ageAt(birthDate, now) >= MIN_AGE;
}

/**
 * Un mineur est refusé partout : l'âge prime sur toutes les autres raisons.
 * Sans questionnaire ou avec une fiabilité < 60, le module reste fermé.
 */
export function eligibilityOf(input: {
  birthDate: Date;
  questionnaireVersion: number | null;
  reliability: number;
  now: Date;
}): Eligibility {
  const reasons: EligibilityReason[] = [];
  if (!isAdult(input.birthDate, input.now)) {
    return { eligible: false, reasons: ['AGE_RESTRICTED'] };
  }
  if (input.questionnaireVersion === null) {
    reasons.push('QUESTIONNAIRE_MISSING');
  }
  if (input.reliability < RELIABILITY_MIN) {
    reasons.push('RELIABILITY_TOO_LOW');
  }
  return { eligible: reasons.length === 0, reasons };
}

export function assertAdult(birthDate: Date, now: Date): void {
  if (!isAdult(birthDate, now)) {
    throw new AppError('AGE_RESTRICTED', 'Le module de rencontres est réservé aux majeurs');
  }
}

/** Lundi 00:00 UTC de la semaine ISO contenant `now`, au format `YYYY-MM-DD`. */
export function weekStart(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.toISOString().slice(0, 10);
}

export function weekEnd(weekStartDate: string): Date {
  return new Date(new Date(`${weekStartDate}T00:00:00.000Z`).getTime() + 7 * DAY_MS);
}

export function invitesLeft(sentThisWeek: number): number {
  return Math.max(0, INVITES_PER_WEEK - sentThisWeek);
}

export function assertInviteQuota(sentThisWeek: number): void {
  if (sentThisWeek >= INVITES_PER_WEEK) {
    throw new AppError('WEEKLY_QUOTA_EXCEEDED', 'Trois invitations par semaine : réessaie lundi', {
      limit: INVITES_PER_WEEK,
    });
  }
}

export function picksLeft(generated: number): number {
  return Math.max(0, PICKS_PER_WEEK - generated);
}

/**
 * Règle produit v1 : la personne qui envoie l'invitation paie le date.
 * Les cas non couverts (auto-invitation, participants identiques) sont refusés.
 */
export function resolvePayer(invite: { from_user_id: string; to_user_id: string }): string {
  if (!invite.from_user_id || !invite.to_user_id) {
    throw new AppError('VALIDATION_ERROR', 'Invitation incomplète : payeur indéterminable');
  }
  if (invite.from_user_id === invite.to_user_id) {
    throw new AppError('VALIDATION_ERROR', 'Un date ne peut pas réunir la même personne');
  }
  return invite.from_user_id;
}

export function canCancelDate(slotStartsAt: Date | null, now: Date): boolean {
  if (!slotStartsAt) {
    return true;
  }
  return now.getTime() <= slotStartsAt.getTime() - CANCEL_WINDOW_HOURS * HOUR_MS;
}

export function cancellableUntil(slotStartsAt: Date | null): Date | null {
  if (!slotStartsAt) {
    return null;
  }
  return new Date(slotStartsAt.getTime() - CANCEL_WINDOW_HOURS * HOUR_MS);
}

const TRANSITIONS: Record<DateStatus, DateStatus[]> = {
  negotiating: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['completed', 'disputed'],
  completed: [],
  cancelled: [],
  no_show: [],
  disputed: [],
};

export function canTransition(from: DateStatus, to: DateStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: DateStatus, to: DateStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError('INVALID_STATE', `Transition ${from} → ${to} interdite`);
  }
}

/** Les deux réponses doivent dire « oui », et le date doit avoir eu lieu. */
export function canRevealContact(input: {
  status: DateStatus;
  myFeedback: { wants_contact: boolean } | null;
  partnerFeedback: { wants_contact: boolean } | null;
}): boolean {
  return (
    (input.status === 'checked_in' || input.status === 'completed') &&
    input.myFeedback?.wants_contact === true &&
    input.partnerFeedback?.wants_contact === true
  );
}
