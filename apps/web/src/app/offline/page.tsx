import { CloudOff } from 'lucide-react';
import type { Metadata } from 'next';

import { t } from '../../i18n';

export const metadata: Metadata = { title: t('offline.title') };

/** Page servie par le service worker quand une navigation échoue hors ligne. */
export default function OfflinePage() {
  return (
    <main className="s-core dk flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-ink">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface2 text-muted">
        <CloudOff className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-bold">{t('offline.title')}</h1>
      <p className="max-w-sm text-sm text-muted">{t('offline.body')}</p>
      <a
        href="/"
        className="min-h-11 rounded-token border-[1.5px] border-line px-4 py-2.5 text-sm font-bold text-ink hover:bg-surface2"
      >
        {t('offline.retry')}
      </a>
    </main>
  );
}
