'use client';

import { decideAccess, type AccessDecision, type Role, type Session } from '@conexa/ui';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { fr } from '../i18n/fr';

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: Session | null;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session | null {
  return useContext(SessionContext);
}

export function useAccess(allowedRoles: readonly Role[]): AccessDecision {
  const session = useSession();
  return useMemo(() => decideAccess(session, allowedRoles), [session, allowedRoles]);
}

/**
 * N'affiche son contenu que si la session et le rôle le permettent. C'est un
 * confort d'affichage : le serveur reste l'autorité (AGENTS.md, règle 5).
 */
export function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const decision = useAccess(roles);
  if (decision === 'allowed') return <>{children}</>;
  return <AccessNotice decision={decision} />;
}

const NOTICE: Record<Exclude<AccessDecision, 'allowed'>, { title: string; body: string }> = {
  login: { title: fr.session.loginTitle, body: fr.session.loginBody },
  pending: { title: fr.session.pendingTitle, body: fr.session.pendingBody },
  suspended: { title: fr.session.suspendedTitle, body: fr.session.suspendedBody },
  forbidden: { title: fr.session.forbiddenTitle, body: fr.session.forbiddenBody },
};

function AccessNotice({ decision }: { decision: Exclude<AccessDecision, 'allowed'> }) {
  const notice = NOTICE[decision];
  return (
    <section
      aria-labelledby="acces-titre"
      className="mx-auto flex max-w-md flex-col items-start gap-3 border border-line bg-surface p-6"
    >
      <h2 id="acces-titre" className="font-display text-lg font-extrabold uppercase text-ink">
        {notice.title}
      </h2>
      <p className="text-sm text-muted">{notice.body}</p>
    </section>
  );
}
