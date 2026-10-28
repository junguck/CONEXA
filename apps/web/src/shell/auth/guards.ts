/** Rôles de `docs/product/API.md` §1. */
export const ROLES = [
  'student',
  'captain',
  'restaurant_staff',
  'partner_staff',
  'moderator',
  'admin',
  'service',
] as const;

export type Role = (typeof ROLES)[number];

export type AccountStatus = 'pending' | 'active' | 'suspended' | 'banned';

export interface Session {
  userId: string;
  role: Role;
  status: AccountStatus;
  displayName?: string;
}

export type GuardResult =
  | { kind: 'allowed' }
  | { kind: 'login' }
  | { kind: 'pending' }
  | { kind: 'suspended' }
  | { kind: 'forbidden' };

/**
 * Décide l'accès côté affichage seulement : le serveur reste l'autorité
 * (AGENTS.md, règle du front qui n'applique jamais seul une règle d'accès).
 */
export function evaluateAccess(
  session: Session | null,
  allowedRoles?: readonly Role[],
): GuardResult {
  if (!session) return { kind: 'login' };
  if (session.status === 'pending') return { kind: 'pending' };
  if (session.status === 'suspended' || session.status === 'banned') return { kind: 'suspended' };
  if (allowedRoles && allowedRoles.length > 0) {
    const isCaptainContext = session.role === 'captain';
    const allowed =
      allowedRoles.includes(session.role) || (isCaptainContext && allowedRoles.includes('student'));
    if (!allowed) return { kind: 'forbidden' };
  }
  return { kind: 'allowed' };
}

export function isActive(session: Session | null): session is Session {
  return evaluateAccess(session).kind === 'allowed';
}
