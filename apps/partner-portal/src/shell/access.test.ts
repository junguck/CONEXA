import { decideAccess, type Session } from '@conexa/ui';
import { describe, expect, it } from 'vitest';

import { PORTAL_ROLES } from './access';

const staff: Session = { userId: 'p1', role: 'restaurant_staff', status: 'active' };

describe('garde du portail partenaire', () => {
  it('ouvre le portail au personnel du restaurant', () => {
    expect(decideAccess(staff, PORTAL_ROLES)).toBe('allowed');
    expect(decideAccess({ ...staff, role: 'partner_staff' }, PORTAL_ROLES)).toBe('allowed');
  });

  it('refuse un étudiant', () => {
    expect(decideAccess({ ...staff, role: 'student' }, PORTAL_ROLES)).toBe('forbidden');
  });

  it('refuse un compte en attente de rattachement', () => {
    expect(decideAccess({ ...staff, status: 'pending' }, PORTAL_ROLES)).toBe('pending');
  });

  it('demande une connexion sans session', () => {
    expect(decideAccess(null, PORTAL_ROLES)).toBe('login');
  });
});
