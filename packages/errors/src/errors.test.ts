import { describe, expect, it } from 'vitest';

import { AppError, forbidden, invalidState, notFound, validationError } from './index.js';

describe('AppError', () => {
  it('porte le statut HTTP du catalogue', () => {
    expect(new AppError('RATE_LIMITED', 'Trop de requêtes').status).toBe(429);
    expect(new AppError('PAYMENT_REQUIRED', 'Payer').status).toBe(402);
  });

  it('expose les détails sans les perdre', () => {
    const error = validationError('Champ invalide', { champ: 'matricule' });
    expect(error.details).toEqual({ champ: 'matricule' });
    expect(error.name).toBe('AppError');
  });

  it('fournit des raccourcis cohérents', () => {
    expect(notFound('Équipe').code).toBe('NOT_FOUND');
    expect(forbidden().code).toBe('FORBIDDEN');
    expect(invalidState('Transition interdite').code).toBe('INVALID_STATE');
  });
});
