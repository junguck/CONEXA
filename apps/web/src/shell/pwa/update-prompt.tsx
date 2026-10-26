'use client';

import { useEffect, useState } from 'react';

import { Button } from '@conexa/ui';

import { t } from '../../i18n';

/**
 * Invite de mise à jour de la PWA : le nouveau service worker attend
 * (skipWaiting: false dans sw.ts) et l'utilisateur choisit de recharger.
 */
export function PwaUpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let cancelled = false;

    const watch = (reg: ServiceWorkerRegistration) => {
      registration = reg;
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(installing);
          }
        });
      });
    };

    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (!cancelled && reg) watch(reg);
    });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void registration?.update();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="mx-4 mb-3 flex flex-col gap-2 rounded-token border border-line bg-surface2 p-3.5 text-ink"
    >
      <p className="text-sm font-bold">{t('update.title')}</p>
      <p className="text-sm text-muted">{t('update.body')}</p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }}
      >
        {t('update.action')}
      </Button>
    </div>
  );
}
