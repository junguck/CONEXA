'use client';

import { cn } from '@conexa/ui';
import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { fr } from '../i18n/fr';

import { isActive, type ConsoleSection } from './nav';
import { useSession } from './session';
import { useTheme } from './theme';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administration',
  moderator: 'Modération',
  partner_staff: 'Partenaire',
  restaurant_staff: 'Restaurant',
};

/**
 * Coquille des consoles (DESIGN_HANDOFF.md §7) : barre du haut avec le mot-symbole,
 * sections, compte et thème. Deux lignes sous `md` pour rester utilisable au doigt.
 */
export function ConsoleFrame({
  sections,
  appLabel,
  children,
}: {
  sections: ConsoleSection[];
  appLabel: string;
  children: ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const session = useSession();
  const identity = session
    ? `${ROLE_LABEL[session.role] ?? session.role} · ${session.displayName ?? 'compte'}`
    : 'Non connecté';

  return (
    <div className={cn('s-core flex min-h-dvh flex-col bg-bg text-ink', theme)}>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-token focus:bg-surface focus:px-3 focus:py-2"
      >
        {fr.skipToContent}
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center gap-3 px-4 md:gap-6 md:px-7">
          <Link href="/" className="flex flex-none items-baseline gap-2">
            <span className="font-display text-lg font-extrabold tracking-[.04em] text-ink">
              CONEXA
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[.12em] text-muted sm:inline">
              {appLabel}
            </span>
          </Link>

          <nav aria-label={fr.navLabel} className="hidden min-w-0 flex-1 items-stretch md:flex">
            {sections.map((section) => (
              <SectionLink
                key={section.href}
                section={section}
                active={isActive(pathname, section)}
              />
            ))}
          </nav>

          <span className="ml-auto hidden text-right font-mono text-[11px] text-muted lg:block">
            {identity}
          </span>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={fr.theme}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-[2px] border border-line text-ink hover:bg-surface2"
          >
            {theme === 'dk' ? (
              <Sun className="h-5 w-5" aria-hidden />
            ) : (
              <Moon className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>

        <nav
          aria-label={fr.navLabel}
          className="flex overflow-x-auto border-t border-line px-2 [scrollbar-width:none] md:hidden"
        >
          {sections.map((section) => (
            <SectionLink
              key={section.href}
              section={section}
              active={isActive(pathname, section)}
              compact
            />
          ))}
        </nav>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-7 md:py-7">
        {children}
      </main>
    </div>
  );
}

function SectionLink({
  section,
  active,
  compact = false,
}: {
  section: ConsoleSection;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={section.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center whitespace-nowrap font-mono uppercase tracking-[.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        compact ? 'min-h-11 border-b-[3px] px-3 text-[11px]' : 'border-b-[3px] px-3.5 text-xs',
        active
          ? 'border-accent font-bold text-accent-text'
          : 'border-transparent text-muted hover:text-ink',
      )}
    >
      {section.label}
    </Link>
  );
}
