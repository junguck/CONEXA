'use client';

import { Badge, Button, Card, Input } from '@conexa/ui';
import { Bookmark, BookmarkCheck, Check } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { jobs } from '../../../../shell/maquettes/data';
import { Hint, TopBar } from '../../../../shell/maquettes/kit';

const FILTERS = ['Toutes', 'Design', 'Développement', 'Tutorat'] as const;
type Filter = (typeof FILTERS)[number];

function category(tags: string[]): Filter {
  if (tags.some((tag) => /figma|print/i.test(tag))) return 'Design';
  if (tags.some((tag) => /nest|postgres/i.test(tag))) return 'Développement';
  return 'Tutorat';
}

export default function ProJobsPage() {
  const [filter, setFilter] = useState<Filter>('Toutes');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [onlySaved, setOnlySaved] = useState(false);
  const savedCount = Object.values(saved).filter(Boolean).length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const inFilter = filter === 'Toutes' || category(job.tags) === filter;
      const inSaved = !onlySaved || saved[job.title] === true;
      const matches =
        needle === '' ||
        `${job.title} ${job.org} ${job.tags.join(' ')}`.toLowerCase().includes(needle);
      return inFilter && inSaved && matches;
    });
  }, [filter, onlySaved, query, saved]);

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Missions" back="/pro" eyebrow="Recommandées pour toi" />

      <Input
        label="Rechercher une mission"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Titre, organisation, compétence"
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
            className={`inline-flex min-h-11 flex-none items-center rounded-full border px-3.5 text-sm font-semibold ${
              filter === item ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink'
            }`}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={onlySaved}
          onClick={() => setOnlySaved((value) => !value)}
          className={`inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${
            onlySaved ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink'
          }`}
        >
          <Bookmark className="h-3.5 w-3.5" aria-hidden /> Enregistrées · {savedCount}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Aucune mission ne correspond.</p>
      ) : null}

      {visible.map((job) => (
        <Card key={job.title} className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-base font-bold">{job.title}</p>
              <p className="text-xs text-muted">{job.org}</p>
            </div>
            <div className="flex flex-none flex-col items-end gap-1">
              <Badge tone="accent">{job.deadline}</Badge>
              <button
                type="button"
                aria-pressed={saved[job.title] ?? false}
                aria-label={
                  saved[job.title]
                    ? `Retirer ${job.title} des missions enregistrées`
                    : `Enregistrer ${job.title}`
                }
                onClick={() =>
                  setSaved((current) => ({ ...current, [job.title]: !current[job.title] }))
                }
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-line ${
                  saved[job.title] ? 'text-accent-text' : 'text-muted'
                }`}
              >
                {saved[job.title] ? (
                  <BookmarkCheck className="h-4 w-4" aria-hidden />
                ) : (
                  <Bookmark className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
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
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" asChild>
              <Link href="/pro/offre">Voir la mission</Link>
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={applied[job.title] === true}
              onClick={() => setApplied((current) => ({ ...current, [job.title]: true }))}
            >
              {applied[job.title] ? (
                <>
                  <Check className="h-4 w-4" aria-hidden /> Envoyée
                </>
              ) : (
                'Postuler'
              )}
            </Button>
          </div>
        </Card>
      ))}

      <Hint>
        Une mission est financée en séquestre avant le démarrage. Aucun avantage sportif n’est
        vendu.
      </Hint>
    </div>
  );
}
