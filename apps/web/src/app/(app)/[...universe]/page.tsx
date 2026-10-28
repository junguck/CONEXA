import { EmptyState } from '@conexa/ui';
import { Compass } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { t } from '../../../i18n';

/** Sections annoncées par la maquette, en attente de leurs agents de domaine. */
const PLANNED = new Set(['football', 'meet', 'pro', 'me']);

const LABELS: Record<string, string> = {
  football: t('nav.football'),
  meet: t('nav.meet'),
  pro: t('nav.pro'),
  me: t('nav.me'),
};

interface PageProps {
  params: Promise<{ universe: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { universe } = await params;
  const section = universe[0];
  if (!section || !PLANNED.has(section)) return {};
  return { title: LABELS[section] ?? section };
}

/**
 * Écran d'attente temporaire des univers dont la route n'existe pas encore.
 * Dès qu'un agent de domaine ajoute `(app)/football/page.tsx`, sa route
 * statique prend le dessus et ce fichier n'est plus utilisé pour ce segment.
 */
export default async function PlannedUniversePage({ params }: PageProps) {
  const { universe } = await params;
  const section = universe[0];
  if (!section || universe.length > 1 || !PLANNED.has(section)) notFound();

  return (
    <div className="flex flex-1 flex-col justify-center py-8">
      <EmptyState
        icon={Compass}
        title={LABELS[section] ?? section}
        description={t('home.comingSoon')}
      />
    </div>
  );
}
