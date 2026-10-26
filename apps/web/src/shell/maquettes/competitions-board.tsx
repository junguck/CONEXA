'use client';

import { Badge, Button, Card } from '@conexa/ui';
import { useState } from 'react';

import { bracket, competitions } from './data';
import { Hint, TopBar } from './kit';

export function CompetitionsBoard() {
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState('');

  return (
    <div className="flex flex-col gap-4 pb-4">
      <TopBar title="Compétitions" back="/football" eyebrow="Saison 2026" />

      {competitions.map((competition) => (
        <Card key={competition.id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-base font-bold">{competition.name}</p>
            <Badge tone={competition.state === 'En cours' ? 'ok' : 'accent'}>
              {competition.state}
            </Badge>
          </div>
          <p className="text-sm text-muted">{competition.format}</p>
        </Card>
      ))}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Coupe du Campus · tableau
        </h2>
        {bracket.map((match, index) => (
          <div
            key={`${match.round}-${index}`}
            className="grid grid-cols-[52px_1fr_auto] items-center gap-2 border-b border-line py-2.5 text-sm last:border-0"
          >
            <span className="font-mono text-[10px] uppercase text-muted">{match.round}</span>
            <span className="truncate text-ink">
              {match.home} <span className="text-muted">/</span> {match.away}
            </span>
            <span className="font-mono text-xs font-bold">{match.score}</span>
          </div>
        ))}
      </section>

      <Button
        block
        variant={joined ? 'outline' : 'primary'}
        onClick={() => {
          setJoined((value) => !value);
          setStatus(
            joined
              ? 'Inscription retirée. Aucun frais, aucun match annulé.'
              : 'Inscription enregistrée pour la Coupe. Le tirage a lieu lundi.',
          );
        }}
      >
        {joined ? 'Retirer l’inscription' : 'Inscrire Info Lions'}
      </Button>

      <p role="status" aria-live="polite" className={status ? 'text-xs text-ink' : 'sr-only'}>
        {status}
      </p>

      <Hint>
        Inscription gratuite. Les forfaits déclenchent un litige, jamais une pénalité financière
        automatique.
      </Hint>
    </div>
  );
}
