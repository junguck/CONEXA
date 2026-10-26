import { featureNav } from './nav.generated';

export interface ConsoleSection {
  label: string;
  href: string;
  /** `/` ne doit s'activer que sur lui-même, pas sur toutes les pages. */
  exact?: boolean;
}

/** Le service du soir d'abord, puis les réglages du restaurant. */
export const sections: ConsoleSection[] = [
  { label: 'Ce soir', href: '/', exact: true },
  { label: 'Menu', href: '/menu' },
  { label: 'Créneaux', href: '/creneaux' },
  ...featureNav.map((item) => ({ label: item.label, href: item.href })),
];

export function isActive(pathname: string, section: ConsoleSection): boolean {
  if (section.exact) return pathname === section.href;
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}
