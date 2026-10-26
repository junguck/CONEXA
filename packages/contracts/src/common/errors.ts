import { z } from 'zod';

/** Code métier → statut HTTP. Source : docs/product/API.md §1. */
export const ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  ACCOUNT_PENDING: 403,
  ACCOUNT_SUSPENDED: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  INVALID_STATE: 409,
  RATE_LIMITED: 429,
  MATRICULE_TAKEN: 409,
  OTP_INVALID: 400,
  AGE_RESTRICTED: 403,
  RELIABILITY_TOO_LOW: 403,
  TEAM_ALREADY_MEMBER: 409,
  TEAM_JOIN_COOLDOWN: 409,
  TEAM_NOT_ACTIVE: 409,
  NOT_CAPTAIN: 403,
  FIELD_SLOT_TAKEN: 409,
  REPORT_ALREADY_SUBMITTED: 409,
  CHAT_DIGIT_BLOCKED: 422,
  CHAT_CONTACT_BLOCKED: 422,
  WEEKLY_QUOTA_EXCEEDED: 409,
  PICK_EXPIRED: 409,
  SLOT_FULL: 409,
  FORMULA_CAP_EXCEEDED: 422,
  PAYMENT_REQUIRED: 402,
  CANCEL_WINDOW_CLOSED: 409,
  CONTACT_NOT_REVEALED: 403,
  ALREADY_BLOCKED: 409,
  DUPLICATE_REQUEST: 409,
  ENTITLEMENT_REQUIRED: 403,
  PLAN_LIMIT_REACHED: 409,
  PLAN_NOT_FOUND: 404,
  PLAN_AUDIENCE_MISMATCH: 422,
  PROMO_INVALID: 422,
  LISTING_NOT_ACTIVE: 409,
  LISTING_PROHIBITED: 422,
  SELF_ORDER_FORBIDDEN: 409,
  SLOT_ALREADY_BOOKED: 409,
  REVISIONS_EXHAUSTED: 409,
  ORDER_NOT_COMPLETED: 409,
  OFFER_NOT_AVAILABLE: 409,
  OFFER_SOLD_OUT: 409,
  OFFER_LIMIT_REACHED: 409,
  VOUCHER_INVALID: 404,
  VOUCHER_ALREADY_USED: 409,
  VOUCHER_EXPIRED: 409,
  PARTNER_NOT_ACTIVE: 403,
  ASSET_NOT_APPROVED: 409,
  /** Extension uploads : fichier trop lourd ou type MIME refusé. */
  UPLOAD_TOO_LARGE: 413,
  UPLOAD_TYPE_NOT_ALLOWED: 415,
  /** Extension opérationnelle : erreur non prévue (jamais exposée en détail). */
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

const ERROR_CODES = Object.keys(ERROR_STATUS) as [ErrorCode, ...ErrorCode[]];

export const ErrorCodeSchema = z.enum(ERROR_CODES);

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
    request_id: z.string().min(1),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export function errorStatus(code: ErrorCode): number {
  return ERROR_STATUS[code];
}
