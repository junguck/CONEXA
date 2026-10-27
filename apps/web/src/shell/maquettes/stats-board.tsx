'use client';

import { Badge, Button, Card, cn } from '@conexa/ui';
import { useState } from 'react';

import { playerStats } from './data';
import { Hint, TopBar } from './kit';

const BADGES = [
  { label: 'Meilleur buteur', holder: 'Aïcha K.', tone: 'accent' as const },
  { label: 'Meilleur passeur', holder: 'Brice J.', tone: 'neutral' as const },
  { label: 'Invincible à domicile', holder: 'Info Lions', tone: 'ok' as const },
];

export function StatsBoard() {
  const [vote, setVote] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  return (
    <div className="flex flex-col gap-4 pb-4">
      <TopBar title="Statistiques" back="/football" eyebrow="Info Lions · saison en cours" />

      <section className="flex flex-col gap-1">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Joueurs
        </h2>
        <div className="grid grid-cols-[1fr_repeat(4,40px)] gap-1 border-b border-line pb-1 text-[10px] uppercase tracking-[.06em] text-muted">
          <span>Joueur</span>
          <span className="text-center">Buts</span>
          <span className="text-center">Passes</span>
          <span className="text-center">Matchs</span>
          <span className="text-center">MVP</span>
        </div>
        {playerStats.map((player) => (
          <div
            key={player.name}
            className="grid min-h-11 grid-cols-[1fr_repeat(4,40px)] items-center gap-1 border-b border-line text-sm last:border-0"
          >
            <span className="truncate font-semibold text-ink">{player.name}</span>
            <span className="text-center font-mono">{player.goals}</span>
            <span className="text-center font-mono">{player.assists}</span>
            <span className="text-center font-mono text-muted">{player.matches}</span>
            <span className="text-center font-mono">{player.mvp}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Vote MVP du dernier match
        </h2>
        <Card className="flex flex-col gap-2">
          <p className="text-sm text-muted">Un vote par joueur, ouvert 48 h après le match.</p>
          <div className="flex flex-wrap gap-1.5">
            {playerStats.map((player) => (
              <button
                key={player.name}
                type="button"
                aria-pressed={vote === player.name}
                onClick={() => {
                  setVote(player.name);
                  setStatus(`Vote enregistré pour ${player.name}. Résultat après la clôture.`);
                }}
                className={cn(
                  'min-h-11 rounded-full border px-3 text-xs font-semibold',
                  vote === player.name
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line text-ink',
                )}
              >
                {player.name}
              </button>
            ))}
          </div>
          <p role="status" aria-live="polite" className={status ? 'text-xs text-ok' : 'sr-only'}>
            {status}
          </p>
          {vote ? (
            <Button size="sm" variant="outline" onClick={() => setVote(null)}>
              Retirer mon vote
            </Button>
          ) : null}
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Badges
        </h2>
        {BADGES.map((badge) => (
          <div
            key={badge.label}
            className="flex min-h-11 items-center justify-between border-b border-line last:border-0"
          >
            <span className="text-sm text-ink">{badge.label}</span>
            <Badge tone={badge.tone}>{badge.holder}</Badge>
          </div>
        ))}
      </section>

      <Hint>
        Les statistiques ne comptent que les matchs validés par les deux capitaines. Le vote MVP
        n’attribue aucun point au classement.
      </Hint>
    </div>
  );
}
