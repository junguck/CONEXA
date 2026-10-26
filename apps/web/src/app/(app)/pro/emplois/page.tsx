import { Badge, Button, Card } from '@conexa/ui';
import Link from 'next/link';

import { jobs } from '../../../../shell/maquettes/data';
import { Hint, TopBar } from '../../../../shell/maquettes/kit';

export default function ProJobsPage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Missions" back="/pro" eyebrow="Recommandées pour toi" />

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {['Toutes', 'Design', 'Développement', 'Tutorat'].map((filter, index) => (
          <span
            key={filter}
            className={`inline-flex min-h-9 flex-none items-center rounded-full border px-3.5 text-sm font-semibold ${
              index === 0 ? 'border-ink bg-ink text-bg' : 'border-line text-ink'
            }`}
          >
            {filter}
          </span>
        ))}
      </div>

      {jobs.map((job) => (
        <Card key={job.title} className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-base font-bold">{job.title}</p>
              <p className="text-xs text-muted">{job.org}</p>
            </div>
            <Badge tone="accent">{job.deadline}</Badge>
          </div>
          <p className="font-mono text-sm font-bold text-accent-text">{job.budget}</p>
          <div className="flex flex-wrap gap-1.5">
            {job.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-semibold"
              >
                {tag}
              </span>
            ))}
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/pro/offre">Voir la mission</Link>
          </Button>
        </Card>
      ))}

      <Hint>
        Une mission est financée en séquestre avant le démarrage. Aucun avantage sportif n’est
        vendu.
      </Hint>
    </div>
  );
}
