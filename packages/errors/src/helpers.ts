import { AppError } from './app-error.js';

/**
 * Helpers v1 (ADR 0007), conservés à l'identique : les services football,
 * dating, talents et marketplace les importent depuis `@conexa/errors`.
 * Les messages par défaut sont ceux de v1, pas ceux des méthodes statiques.
 */

export const notFound = (what: string): AppError =>
  new AppError('NOT_FOUND', `${what} introuvable`);

export const forbidden = (message = 'Action interdite'): AppError =>
  new AppError('FORBIDDEN', message);

export const invalidState = (message: string): AppError => new AppError('INVALID_STATE', message);

export const validationError = (message: string, details?: Record<string, unknown>): AppError =>
  new AppError('VALIDATION_ERROR', message, details);
