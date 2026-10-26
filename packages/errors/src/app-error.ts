import type { ErrorCode } from './codes.js';
import { httpStatusFor } from './http.js';

/** Corps d'erreur — `docs/product/API.md` §1 « Format d'erreur ». */
export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  request_id?: string;
}

/** `{ "error": { ... } }` : forme unique renvoyée par le Gateway et les services. */
export interface ErrorEnvelope {
  error: ErrorPayload;
}

export interface AppErrorOptions {
  details?: Record<string, unknown>;
  requestId?: string;
  cause?: unknown;
}

/** Messages par défaut des codes dont le texte porte une règle métier. */
const ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  ACCOUNT_PENDING: 'Compte en attente de validation par un administrateur.',
  ACCOUNT_SUSPENDED: 'Compte suspendu ou banni.',
  OTP_INVALID: 'Code invalide ou expiré.',
  AGE_RESTRICTED: 'Le module rencontres est réservé aux personnes majeures.',
  RELIABILITY_TOO_LOW: 'Score de fiabilité trop bas pour cette action.',
  CHAT_DIGIT_BLOCKED: 'Message refusé : chiffre ou numéro détecté.',
  CHAT_CONTACT_BLOCKED: 'Message refusé : demande de contact interdite.',
  PAYMENT_REQUIRED: 'Paiement requis pour continuer.',
  CANCEL_WINDOW_CLOSED: 'Annulation impossible à moins de 3 h.',
  CONTACT_NOT_REVEALED: 'Contact non révélé : il faut un « oui » mutuel.',
  DUPLICATE_REQUEST: 'Idempotency-Key déjà utilisée avec un autre corps.',
  ENTITLEMENT_REQUIRED: 'Fonction réservée à un abonnement.',
  PLAN_LIMIT_REACHED: 'Quota du plan atteint.',
  INTERNAL_ERROR: 'Erreur interne.',
};

function defaultMessage(code: ErrorCode): string {
  const known = ERROR_MESSAGES[code];
  if (known !== undefined) return known;
  switch (httpStatusFor(code)) {
    case 400:
      return 'Requête invalide.';
    case 401:
      return 'Authentification requise.';
    case 402:
      return 'Paiement requis.';
    case 403:
      return 'Accès refusé.';
    case 404:
      return 'Ressource introuvable.';
    case 409:
      return "Opération impossible dans l'état actuel.";
    case 422:
      return 'Données invalides.';
    case 429:
      return 'Trop de requêtes : réessayez plus tard.';
    default:
      return 'Erreur interne.';
  }
}

/**
 * Erreur métier typée : le service lève `AppError`, le Gateway la sérialise.
 * Jamais de `throw` de chaîne, jamais de détail technique dans la réponse.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(code: ErrorCode, message?: string, options: AppErrorOptions = {}) {
    super(
      message ?? defaultMessage(code),
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = 'AppError';
    this.code = code;
    this.status = httpStatusFor(code);
    if (options.details !== undefined) this.details = options.details;
    if (options.requestId !== undefined) this.requestId = options.requestId;
  }

  /** Enveloppe prête à sérialiser (`request_id` rempli si connu). */
  toEnvelope(): ErrorEnvelope {
    const payload: ErrorPayload = { code: this.code, message: this.message };
    if (this.details !== undefined) payload.details = this.details;
    if (this.requestId !== undefined) payload.request_id = this.requestId;
    return { error: payload };
  }

  static unauthenticated(message?: string, options?: AppErrorOptions): AppError {
    return new AppError('UNAUTHENTICATED', message, options);
  }

  static forbidden(message?: string, options?: AppErrorOptions): AppError {
    return new AppError('FORBIDDEN', message, options);
  }

  static notFound(message?: string, options?: AppErrorOptions): AppError {
    return new AppError('NOT_FOUND', message, options);
  }

  static validation(details: Record<string, unknown>, message?: string): AppError {
    return new AppError('VALIDATION_ERROR', message, { details });
  }

  static invalidState(message?: string, options?: AppErrorOptions): AppError {
    return new AppError('INVALID_STATE', message, options);
  }

  static rateLimited(message?: string, options?: AppErrorOptions): AppError {
    return new AppError('RATE_LIMITED', message, options);
  }

  static internal(message?: string, options?: AppErrorOptions): AppError {
    return new AppError('INTERNAL_ERROR', message, options);
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Convertit n'importe quelle erreur en enveloppe sûre : une erreur inconnue
 * devient `INTERNAL_ERROR`, sans message ni pile technique exposés.
 */
export function toErrorEnvelope(error: unknown, requestId?: string): ErrorEnvelope {
  if (isAppError(error)) {
    const envelope = error.toEnvelope();
    if (envelope.error.request_id === undefined && requestId !== undefined) {
      envelope.error.request_id = requestId;
    }
    return envelope;
  }
  const envelope: ErrorEnvelope = {
    error: { code: 'INTERNAL_ERROR', message: defaultMessage('INTERNAL_ERROR') },
  };
  if (requestId !== undefined) envelope.error.request_id = requestId;
  return envelope;
}
