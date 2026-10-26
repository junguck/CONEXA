import { EmptyState } from '@conexa/ui';
import { ArrowRight, Compass } from 'lucide-react';
import Link from 'next/link';

import { t } from '../../i18n';
import { featureNav } from '../../shell/nav.generated';

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6 pb-4 pt-2">
      <section className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[.14em] text-accent-text">
          Campus Douala
        </p>
        <h1 className="font-display text-[clamp(2rem,8vw,2.75rem)] font-bold leading-[1.05] text-ink">
          {t('home.title')}
        </h1>
        <p className="max-w-prose text-sm text-muted">{t('home.subtitle')}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-[.08em] text-muted">
          {t('home.modulesTitle')}
        </h2>

        {featureNav.length === 0 ? (
          <EmptyState
            icon={Compass}
            title={t('home.modulesTitle')}
            description={t('home.modulesEmpty')}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {featureNav.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={entry.href}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-panel border border-line bg-surface px-4 py-3 text-ink transition-colors hover:bg-surface2"
                >
                  <span className="flex flex-col">
                    <span className="font-display text-base font-bold">{entry.label}</span>
                    <span className="font-mono text-xs text-muted">{entry.href}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 text-accent-text" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/design"
        className="self-start text-sm font-semibold text-accent-text underline-offset-4 hover:underline"
      >
        {t('home.designLink')}
      </Link>
    </div>
  );
}
