import type { ReactNode } from 'react';

import { SessionProvider } from '../../shell/auth/session';
import { ShellFrame } from '../../shell/shell-frame';

/**
 * Coquille de tous les écrans de l'app (hors connexion et hors-ligne).
 * La session sera fournie par le service Identity (F1.1) ; tant qu'il n'existe
 * pas, les gardes de `shell/auth` restent inactives et l'affichage est public.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider session={null}>
      <ShellFrame>{children}</ShellFrame>
    </SessionProvider>
  );
}
