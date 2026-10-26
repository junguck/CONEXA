import { commission, type Offer, type OfferBlockedReason } from '@conexa/contracts';

/**
 * Règles pures du domaine partenaire : fenêtre d'un créneau, disponibilité
 * d'une offre, remise appliquée. Aucune I/O, testées directement.
 */

export const MIN_SLOT_MINUTES = 30;
export const MAX_SLOT_MINUTES = 8 * 60;

export type SlotVerdict =
  | { ok: true; minutes: number }
  | { ok: false; reason: 'SLOT_IN_PAST' | 'SLOT_TOO_SHORT' | 'SLOT_TOO_LONG' };

/** Un créneau se crée dans le futur, dure entre 30 min et 8 h, jamais à cheval. */
export function checkSlotWindow(startsAt: Date, endsAt: Date, now: Date): SlotVerdict {
  const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  if (minutes <= 0) return { ok: false, reason: 'SLOT_TOO_SHORT' };
  if (startsAt.getTime() <= now.getTime()) return { ok: false, reason: 'SLOT_IN_PAST' };
  if (minutes < MIN_SLOT_MINUTES) return { ok: false, reason: 'SLOT_TOO_SHORT' };
  if (minutes > MAX_SLOT_MINUTES) return { ok: false, reason: 'SLOT_TOO_LONG' };
  return { ok: true, minutes };
}

/** Deux créneaux du même lieu ne se chevauchent jamais. */
export function overlaps(
  a: { startsAt: Date; endsAt: Date },
  b: { startsAt: Date; endsAt: Date },
): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

export function offerBlockedReason(
  offer: Pick<Offer, 'quota' | 'redeemed_count' | 'valid_until'>,
  now: Date,
): OfferBlockedReason | null {
  if (offer.valid_until !== null && new Date(offer.valid_until) <= now) return 'expired';
  if (offer.quota !== null && offer.redeemed_count >= offer.quota) return 'exhausted';
  return null;
}

/**
 * Remise d'une offre sur un montant. Une offre `fixed` ne dépasse jamais le
 * montant : un bon ne peut pas transformer une commande en crédit.
 */
export function discountFor(amount: number, offer: Pick<Offer, 'kind' | 'value'>): number {
  if (amount <= 0) return 0;
  if (offer.kind === 'percent') {
    if (offer.value <= 0) return 0;
    return Math.min(amount, commission(amount, Math.min(offer.value, 100)));
  }
  return Math.min(amount, Math.max(0, offer.value));
}

/** Code de retrait lisible au comptoir : 8 caractères, sans I/O ni 0. */
export function redemptionCode(random: () => number, length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += alphabet[Math.floor(random() * alphabet.length)] ?? 'X';
  }
  return code;
}

export function normalizeCity(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}
