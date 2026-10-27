import type { Role, Session } from '@conexa/ui';

/** Rôles autorisés à ouvrir le portail partenaire (T-0009, `API.md` §1). */
export const PORTAL_ROLES = [
  'partner_staff',
  'restaurant_staff',
] as const satisfies readonly Role[];

/**
 * Session d'aperçu, utilisée uniquement pour la maquette locale : sans le
 * service Identity (F1.1), aucun jeton réel n'existe. La variable n'est jamais
 * posée en production ; sans elle, les gardes montrent l'écran de connexion.
 */
export function previewSession(role: Role = 'restaurant_staff'): Session | null {
  if (process.env['NEXT_PUBLIC_CONSOLE_PREVIEW_SESSION'] !== 'true') return null;
  return { userId: 'preview', role, status: 'active', displayName: 'Chez Mama Têté' };
}
