import { describe, expect, it } from 'vitest';

import { decideAccess, isActive, type Session } from './access';

const admin: Session = { userId: 'u1', role: 'admin', status: 'active' };
const staff: Session = { userId: 'u2', role: 'restaurant_staff', status: 'active' };

const CONSOLE: readonly ('admin' | 'moderator')[] = ['admin', 'moderator'];

describe('decideAccess', () => {
  it('accepte le rôle attendu', () => {
    expect(decideAccess(admin, CONSOLE)).toBe('allowed');
  });

  it('refuse un rôle étranger à la console', () => {
    expect(decideAccess(staff, CONSOLE)).toBe('forbidden');
  });

  it('refuse avant tout contrôle de rôle un compte en attente ou suspendu', () => {
    expect(decideAccess({ ...admin, status: 'pending' }, CONSOLE)).toBe('pending');
    expect(decideAccess({ ...admin, status: 'banned' }, CONSOLE)).toBe('suspended');
  });

  it('demande une connexion sans session', () => {
    expect(decideAccess(null, CONSOLE)).toBe('login');
    expect(decideAccess(null)).toBe('login');
  });

  it('traite le capitaine comme un étudiant sans lui ouvrir les consoles', () => {
    const captain: Session = { userId: 'u3', role: 'captain', status: 'active' };
    expect(decideAccess(captain, ['student'])).toBe('allowed');
    expect(decideAccess(captain, CONSOLE)).toBe('forbidden');
  });

  it('n’impose aucun rôle quand la liste est absente', () => {
    expect(decideAccess(staff)).toBe('allowed');
    expect(isActive(staff)).toBe(true);
    expect(isActive(null)).toBe(false);
  });
});
