import { describe, expect, it } from 'vitest';

import { evaluateAccess, isActive, type Session } from './guards';

const student: Session = { userId: 'u1', role: 'student', status: 'active' };

describe('evaluateAccess', () => {
  it('renvoie login sans session', () => {
    expect(evaluateAccess(null)).toEqual({ kind: 'login' });
  });

  it('bloque un compte en attente avant même de regarder le rôle', () => {
    expect(evaluateAccess({ ...student, status: 'pending' }, ['admin'])).toEqual({
      kind: 'pending',
    });
  });

  it('bloque un compte suspendu ou banni', () => {
    expect(evaluateAccess({ ...student, status: 'suspended' })).toEqual({ kind: 'suspended' });
    expect(evaluateAccess({ ...student, status: 'banned' })).toEqual({ kind: 'suspended' });
  });

  it('autorise un rôle listé et refuse les autres', () => {
    expect(evaluateAccess(student, ['student'])).toEqual({ kind: 'allowed' });
    expect(evaluateAccess(student, ['admin'])).toEqual({ kind: 'forbidden' });
  });

  it('traite le capitaine comme un étudiant dans un contexte étudiant', () => {
    const captain: Session = { ...student, role: 'captain' };
    expect(evaluateAccess(captain, ['student'])).toEqual({ kind: 'allowed' });
    expect(evaluateAccess(captain, ['admin'])).toEqual({ kind: 'forbidden' });
  });

  it('laisse passer tout rôle actif quand aucun rôle n’est exigé', () => {
    expect(evaluateAccess({ ...student, role: 'moderator' })).toEqual({ kind: 'allowed' });
  });
});

describe('isActive', () => {
  it('ne considère actif qu’un compte autorisé', () => {
    expect(isActive(student)).toBe(true);
    expect(isActive(null)).toBe(false);
    expect(isActive({ ...student, status: 'pending' })).toBe(false);
  });
});
