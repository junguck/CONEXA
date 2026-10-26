'use client';

import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { t } from '../i18n';

import { BottomNav } from './bottom-nav';
import { PwaUpdatePrompt } from './pwa/update-prompt';
import { ThemeProvider, useTheme } from './theme';
import { universeForPath } from './universe';

/** Coquille mobile : identité d'univers, entête, contenu, barre basse. */
export function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const universe = universeForPath(pathname);

  return (
    <ThemeProvider defaultTheme={universe.defaultTheme}>
      <Frame universeClassName={universe.className}>{children}</Frame>
    </ThemeProvider>
  );
}

function Frame({
  universeClassName,
  children,
}: {
  universeClassName: string;
  children: ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const immersive = pathname === '/meet/match';

  if (immersive) {
    return (
      <div className={`${universeClassName} ${theme} flex min-h-dvh flex-col bg-bg text-ink`}>
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-8">{children}</main>
      </div>
    );
  }

  return (
    <div className={`${universeClassName} ${theme} flex min-h-dvh flex-col bg-bg text-ink`}>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-token focus:bg-surface focus:px-3 focus:py-2"
      >
        {t('skipToContent')}
      </a>

      <header className="flex min-h-16 items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <span className="font-display text-lg font-bold tracking-tight text-ink">CONEXA</span>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t('actions.theme')}
          className="flex h-11 w-11 items-center justify-center rounded-token border border-line text-ink hover:bg-surface2"
        >
          {theme === 'dk' ? (
            <Sun className="h-5 w-5" aria-hidden />
          ) : (
            <Moon className="h-5 w-5" aria-hidden />
          )}
        </button>
      </header>

      <main id="contenu" className="flex flex-1 flex-col px-4 pb-6">
        {children}
      </main>

      <PwaUpdatePrompt />
      <BottomNav />
    </div>
  );
}
