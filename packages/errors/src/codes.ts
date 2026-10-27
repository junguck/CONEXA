/**
 * Codes d'erreur métier de l'API Convexa.
 *
 * Source de vérité : `docs/product/API.md` §1 « Codes d'erreur métier ».
 * Chaque code du document figure ici ; `INTERNAL_ERROR` complète la liste pour
 * les échecs imprévus que le Gateway normalise (500, aucun détail exposé).
 *
 * Retirer un code rompt le contrat des clients : cela se fait en `/v2`,
 * jamais par suppression silencieuse.
 */
export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'ACCOUNT_PENDING',
  'ACCOUNT_SUSPENDED',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'INVALID_STATE',
  'RATE_LIMITED',
  'MATRICULE_TAKEN',
  'OTP_INVALID',
  'AGE_RESTRICTED',
  'RELIABILITY_TOO_LOW',
  'TEAM_ALREADY_MEMBER',
  'TEAM_JOIN_COOLDOWN',
  'TEAM_NOT_ACTIVE',
  'NOT_CAPTAIN',
  'FIELD_SLOT_TAKEN',
  'REPORT_ALREADY_SUBMITTED',
  'CHAT_DIGIT_BLOCKED',
  'CHAT_CONTACT_BLOCKED',
  'WEEKLY_QUOTA_EXCEEDED',
  'PICK_EXPIRED',
  'SLOT_FULL',
  'FORMULA_CAP_EXCEEDED',
  'PAYMENT_REQUIRED',
  'CANCEL_WINDOW_CLOSED',
  'CONTACT_NOT_REVEALED',
  'ALREADY_BLOCKED',
  'DUPLICATE_REQUEST',
  'ENTITLEMENT_REQUIRED',
  'PLAN_LIMIT_REACHED',
  'PLAN_NOT_FOUND',
  'PLAN_AUDIENCE_MISMATCH',
  'PROMO_INVALID',
  'LISTING_NOT_ACTIVE',
  'LISTING_PROHIBITED',
  'SELF_ORDER_FORBIDDEN',
  'SLOT_ALREADY_BOOKED',
  'REVISIONS_EXHAUSTED',
  'ORDER_NOT_COMPLETED',
  'OFFER_NOT_AVAILABLE',
  'OFFER_SOLD_OUT',
  'OFFER_LIMIT_REACHED',
  'VOUCHER_INVALID',
  'VOUCHER_ALREADY_USED',
  'VOUCHER_EXPIRED',
  'PARTNER_NOT_ACTIVE',
  'ASSET_NOT_APPROVED',
  /** Extension uploads : fichier trop lourd ou type MIME refusé (piste v1). */
  'UPLOAD_TOO_LARGE',
  'UPLOAD_TYPE_NOT_ALLOWED',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Vrai si la chaîne est un code métier connu (validation d'une réponse, d'un journal). */
export function isErrorCode(value: string): value is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(value);
}
