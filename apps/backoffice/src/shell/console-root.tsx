'use client';

import type { Role, Session } from '@conexa/ui';
import type { ReactNode } from 'react';

import { ConsoleFrame } from './console-frame';
import { sections } from './nav';
import { RequireRole, SessionProvider } from './session';
import { ThemeProvider } from './theme';

/** Racine client : thème, session et garde de rôle autour de la coquille. */
export function ConsoleRoot({
  session,
  roles,
  appLabel,
  children,
}: {
  session: Session | null;
  roles: readonly Role[];
  appLabel: string;
  children: ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider>
        <ConsoleFrame sections={sections} appLabel={appLabel}>
          <RequireRole roles={roles}>{children}</RequireRole>
        </ConsoleFrame>
      </ThemeProvider>
    </SessionProvider>
  );
}
