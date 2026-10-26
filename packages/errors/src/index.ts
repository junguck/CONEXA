import { errorStatus, type ErrorCode } from '@conexa/contracts';

/** Erreur métier portée jusqu'au filtre HTTP, qui la traduit en enveloppe API. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }

  get status(): number {
    return errorStatus(this.code);
  }
}

export const notFound = (what: string): AppError =>
  new AppError('NOT_FOUND', `${what} introuvable`);

export const forbidden = (message = 'Action interdite'): AppError =>
  new AppError('FORBIDDEN', message);

export const invalidState = (message: string): AppError => new AppError('INVALID_STATE', message);

export const validationError = (message: string, details?: Record<string, unknown>): AppError =>
  new AppError('VALIDATION_ERROR', message, details);
