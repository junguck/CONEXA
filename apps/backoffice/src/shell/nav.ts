import { featureNav } from './nav.generated';

export interface ConsoleSection {
  label: string;
  href: string;
  /** `/` ne doit s'activer que sur lui-même, pas sur toutes les pages. */
  exact?: boolean;
}

/**
 * Sections de la maquette (Validation, Litiges, Finance), puis les domaines qui
 * déposent `src/features/<domaine>/nav.ts` et relancent `gen:registry`.
 */
export const sections: ConsoleSection[] = [
  { label: 'Validation', href: '/', exact: true },
  { label: 'Litiges', href: '/litiges' },
  { label: 'Finance', href: '/finance' },
  ...featureNav.map((item) => ({ label: item.label, href: item.href })),
];

export function isActive(pathname: string, section: ConsoleSection): boolean {
  if (section.exact) return pathname === section.href;
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}
