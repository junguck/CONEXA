import type { CardType } from '@conexa/contracts';
import { validationError } from '@conexa/errors';

/** Chaque carte n'accepte qu'une charge utile fermée : jamais de texte libre. */
export const CARD_PAYLOAD_KEY: Record<CardType, 'slot_id' | 'formula_id' | 'order_id' | null> = {
  SLOT_PROPOSE: 'slot_id',
  SLOT_ACCEPT: 'slot_id',
  SLOT_DECLINE: 'slot_id',
  FORMULA_SELECT: 'formula_id',
  ORDER_DONE: 'order_id',
  ARRIVE_EARLY: null,
  SHY: null,
  LATE_5: null,
  LATE_10: null,
  LATE_15: null,
  READY: null,
  CONFIRM_YES: null,
  CONFIRM_NO: null,
  THANKS: null,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function payloadFor(
  cardType: CardType,
  payload: Record<string, unknown> | undefined,
): Record<string, string> {
  const expectedKey = CARD_PAYLOAD_KEY[cardType];
  const entries = Object.entries(payload ?? {});

  if (expectedKey === null) {
    if (entries.length > 0) {
      throw validationError(`La carte ${cardType} n’accepte aucune charge utile`);
    }
    return {};
  }

  if (entries.length !== 1 || entries[0]?.[0] !== expectedKey) {
    throw validationError(`La carte ${cardType} attend exactement { ${expectedKey} }`);
  }
  const value = entries[0][1];
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw validationError(`Champ ${expectedKey} invalide`);
  }
  return { [expectedKey]: value };
}
