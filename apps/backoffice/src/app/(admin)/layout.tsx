import type { ReactNode } from 'react';

import { fr } from '../../i18n/fr';
import { BACKOFFICE_ROLES, previewSession } from '../../shell/access';
import { ConsoleRoot } from '../../shell/console-root';

/**
 * Toutes les pages du back-office passent par la garde `admin` / `moderator`.
 * La session réelle viendra d'Identity (F1.1) ; `previewSession` ne renvoie un
 * compte que si `NEXT_PUBLIC_CONSOLE_PREVIEW_SESSION=true` (aperçu local).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ConsoleRoot session={previewSession('admin')} roles={BACKOFFICE_ROLES} appLabel={fr.appLabel}>
      {children}
    </ConsoleRoot>
  );
}
