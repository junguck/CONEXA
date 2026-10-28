import type { ReactNode } from 'react';

import { fr } from '../../i18n/fr';
import { PORTAL_ROLES, previewSession } from '../../shell/access';
import { ConsoleRoot } from '../../shell/console-root';

/**
 * Toutes les pages du portail passent par la garde `partner_staff` /
 * `restaurant_staff`. La session réelle viendra d'Identity (F1.1) ;
 * `previewSession` ne renvoie un compte que si
 * `NEXT_PUBLIC_CONSOLE_PREVIEW_SESSION=true` (aperçu local).
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <ConsoleRoot
      session={previewSession('restaurant_staff')}
      roles={PORTAL_ROLES}
      appLabel={fr.appLabel}
    >
      {children}
    </ConsoleRoot>
  );
}
