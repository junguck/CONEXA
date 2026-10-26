export type Universe = 'core' | 'foot' | 'meet' | 'pro';
export type Theme = 'dk' | 'lt';

export interface UniverseConfig {
  id: Universe;
  className: string;
  defaultTheme: Theme;
  label: string;
}

const UNIVERSES: Record<Universe, UniverseConfig> = {
  core: { id: 'core', className: 's-core', defaultTheme: 'dk', label: 'Convexa' },
  foot: { id: 'foot', className: 's-foot', defaultTheme: 'dk', label: 'Foot' },
  meet: { id: 'meet', className: 's-meet', defaultTheme: 'lt', label: 'Meet' },
  pro: { id: 'pro', className: 's-pro', defaultTheme: 'lt', label: 'Pro' },
};

/**
 * L'univers suit la première section de l'URL (DESIGN_HANDOFF.md §1 et §2).
 * Les écrans de compte et de chargement restent dans l'identité Core.
 */
export function universeForPath(pathname: string): UniverseConfig {
  if (pathname === '/football' || pathname.startsWith('/football/')) return UNIVERSES.foot;
  if (pathname === '/meet' || pathname.startsWith('/meet/')) return UNIVERSES.meet;
  if (pathname === '/pro' || pathname.startsWith('/pro/')) return UNIVERSES.pro;
  return UNIVERSES.core;
}

export { UNIVERSES };
