'use client';

import Link from 'next/link';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { t } from '../../i18n';
import { Button } from '@conexa/ui';

import { evaluateAccess, type GuardResult, type Role, type Session } from './guards';

const SessionContext = createContext<Session | null>(null);

/**
 * Fournit la session courante. Aucune session n'existe tant que le service
 * Identity n'est pas livré (F1.1) : le fournisseur accepte la session du
 * serveur et les écrans utilisent les gardes ci-dessous dès qu'elle arrive.
 */
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

export function useAccess(allowedRoles?: readonly Role[]): GuardResult {
  const session = useSession();
  return useMemo(() => evaluateAccess(session, allowedRoles), [session, allowedRoles]);
}

/** N'affiche son contenu que si la session et le rôle le permettent. */
export function RequireRole({
  roles,
  children,
  forbiddenFallback,
}: {
  roles?: readonly Role[];
  children: ReactNode;
  forbiddenFallback?: ReactNode;
}) {
  const result = useAccess(roles);
  if (result.kind === 'allowed') return <>{children}</>;
  if (result.kind === 'forbidden' && forbiddenFallback) return <>{forbiddenFallback}</>;
  return <AccessNotice result={result} />;
}

const NOTICE: Record<
  Exclude<GuardResult['kind'], 'allowed'>,
  { title: string; body: string; action: string | null }
> = {
  login: { title: t('auth.loginTitle'), body: t('auth.loginBody'), action: t('auth.loginAction') },
  pending: { title: t('auth.pendingTitle'), body: t('auth.pendingBody'), action: null },
  suspended: { title: t('auth.suspendedTitle'), body: t('auth.suspendedBody'), action: null },
  forbidden: { title: t('auth.forbiddenTitle'), body: t('auth.forbiddenBody'), action: null },
};

/** Explication d'un refus d'accès ; le bouton de connexion arrive avec F1.1. */
export function AccessNotice({ result }: { result: Exclude<GuardResult, { kind: 'allowed' }> }) {
  const notice = NOTICE[result.kind];
  return (
    <section className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-panel border border-line bg-surface px-6 py-10 text-center">
      <h2 className="font-display text-lg font-bold text-ink">{notice.title}</h2>
      <p className="text-sm text-muted">{notice.body}</p>
      {notice.action ? (
        <Button asChild variant="primary">
          <Link href="/login">{notice.action}</Link>
        </Button>
      ) : null}
    </section>
  );
}
