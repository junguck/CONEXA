'use client';

import { Badge, Button, Card } from '@conexa/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { dates } from './data';
import { Hint, Photo, TopBar } from './kit';

const PAST = [
  {
    name: 'Nadia',
    restaurant: 'Chez Tantie',
    when: 'Samedi dernier',
    status: 'Terminé',
    amount: '7 000 FCFA',
    variant: 2 as const,
  },
];

type Tab = 'upcoming' | 'past';

export function DatesList() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [cancelled, setCancelled] = useState<string[]>([]);
  const [status, setStatus] = useState('');

  const upcoming = useMemo(
    () => dates.filter((date) => !cancelled.includes(date.name)),
    [cancelled],
  );

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Mes dates" back="/meet" eyebrow="Rencontres" />

      <div className="flex gap-1.5">
        {[
          { id: 'upcoming' as const, label: 'À venir' },
          { id: 'past' as const, label: 'Passés' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-11 flex-1 rounded-full border text-sm font-semibold ${
              tab === item.id ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'upcoming' ? (
        <>
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Aucun date à venir. Les propositions Meet arrivent le lundi.
            </p>
          ) : null}
          {upcoming.map((date) => (
            <Card key={date.name} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Photo name={date.name} variant={date.variant} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold">{date.name}</p>
                  <p className="truncate text-xs text-muted">
                    {date.restaurant} · {date.when}
                  </p>
                  <p className="mt-1 font-mono text-xs text-ink">{date.amount} · séquestre</p>
                </div>
                <Badge tone={date.status === 'Confirmé' ? 'ok' : 'accent'}>{date.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button asChild size="sm" variant="outline">
                  <Link href="/meet/jour">Voir le jour J</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/meet/chat">Écrire</Link>
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setCancelled((current) => [...current, date.name]);
                    setStatus(
                      `Date annulé. Remboursement du séquestre sous 48 h, sans frais si le date a lieu dans plus de 3 h.`,
                    );
                  }}
                >
                  Annuler
                </Button>
              </div>
            </Card>
          ))}
        </>
      ) : (
        PAST.map((date) => (
          <Card key={date.name} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Photo name={date.name} variant={date.variant} className="h-14 w-14" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold">{date.name}</p>
                <p className="truncate text-xs text-muted">
                  {date.restaurant} · {date.when}
                </p>
              </div>
              <Badge tone="neutral">{date.status}</Badge>
            </div>
            <Button asChild size="sm" variant="outline" block>
              <Link href="/meet/feedback">Donner mon retour</Link>
            </Button>
          </Card>
        ))
      )}

      <p role="status" aria-live="polite" className={status ? 'text-xs text-ink' : 'sr-only'}>
        {status}
      </p>

      <Hint>
        Annulation gratuite jusqu’à 3 h avant le date. Le montant et la politique de remboursement
        sont affichés avant paiement, sans frais caché.
      </Hint>
    </div>
  );
}
