/**
 * Politique d'accès côté affichage (docs/product/API.md §1). Le serveur reste
 * l'autorité : ces fonctions décident seulement ce qu'un écran peut montrer.
 */

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

export type AccessDecision = 'allowed' | 'login' | 'pending' | 'suspended' | 'forbidden';

/**
 * Un capitaine est un étudiant : il garde l'accès étudiant et gagne les écrans
 * capitaine. Aucun autre cumul de rôles n'est supposé par le front.
 */
export function decideAccess(
  session: Session | null,
  allowedRoles?: readonly Role[],
): AccessDecision {
  if (!session) return 'login';
  if (session.status === 'pending') return 'pending';
  if (session.status === 'suspended' || session.status === 'banned') return 'suspended';
  if (!allowedRoles || allowedRoles.length === 0) return 'allowed';

  const isCaptain = session.role === 'captain';
  const allowed =
    allowedRoles.includes(session.role) || (isCaptain && allowedRoles.includes('student'));
  return allowed ? 'allowed' : 'forbidden';
}

export function isActive(session: Session | null): session is Session {
  return decideAccess(session) === 'allowed';
}
