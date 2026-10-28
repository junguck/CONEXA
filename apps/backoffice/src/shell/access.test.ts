import { decideAccess, type Session } from '@conexa/ui';
import { describe, expect, it } from 'vitest';

import { BACKOFFICE_ROLES } from './access';

const moderator: Session = { userId: 'm1', role: 'moderator', status: 'active' };
const student: Session = { userId: 's1', role: 'student', status: 'active' };

describe('garde du back-office', () => {
  it('ouvre l’espace à un modérateur actif', () => {
    expect(decideAccess(moderator, BACKOFFICE_ROLES)).toBe('allowed');
  });

  it('refuse un étudiant', () => {
    expect(decideAccess(student, BACKOFFICE_ROLES)).toBe('forbidden');
  });

  it('refuse un partenaire', () => {
    const staff: Session = { userId: 'p1', role: 'partner_staff', status: 'active' };
    expect(decideAccess(staff, BACKOFFICE_ROLES)).toBe('forbidden');
  });

  it('ne montre pas l’espace sans session', () => {
    expect(decideAccess(null, BACKOFFICE_ROLES)).toBe('login');
  });
});
