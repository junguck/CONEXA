'use client';

import { Badge, Button, TickPlate, cn } from '@conexa/ui';
import { useState } from 'react';

import { DISPUTES } from '../../shell/fixtures';

/**
 * Litiges ouverts (maquette BoDisputes) : liste, dossier et actions. Aucune
 * décision n'est appliquée ici — le service de litiges et la revue humaine
 * restent seuls juges (AGENTS.md).
 */
export function DisputesBoard() {
  const [selectedId, setSelectedId] = useState(DISPUTES[0]?.id ?? '');
  const [feedback, setFeedback] = useState('');
  const selected = DISPUTES.find((dispute) => dispute.id === selectedId) ?? DISPUTES[0];

  if (!selected) return <p className="text-sm text-muted">Aucun litige ouvert.</p>;

  function request(action: string) {
    setFeedback(
      `« ${action} » : la demande part au serveur dès que le service Litiges est branché. Aucune décision n’est prise côté navigateur.`,
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <ul className="flex flex-col divide-y divide-line border border-line bg-surface">
        {DISPUTES.map((dispute) => {
          const active = dispute.id === selected.id;
          return (
            <li key={dispute.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(dispute.id);
                  setFeedback('');
                }}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors',
                  active ? 'bg-surface2' : 'hover:bg-surface2',
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn('h-2 w-2 flex-none', active ? 'bg-accent' : 'bg-muted')}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    {dispute.title}
                  </span>
                  {dispute.urgent ? <Badge tone="live">Urgent</Badge> : null}
                </span>
                <span className="pl-4 font-mono text-[11px] uppercase tracking-[.06em] text-muted">
                  {dispute.context}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <TickPlate className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={selected.urgent ? 'live' : 'accent'}>{selected.kind}</Badge>
          <span className="font-mono text-[10px] uppercase tracking-[.08em] text-muted">
            {selected.age}
          </span>
        </div>

        <h2 className="font-display text-2xl font-extrabold uppercase leading-tight text-ink">
          {selected.title}
        </h2>

        {selected.declarations ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <TickPlate tick={false} className="bg-surface2">
              <p className="font-mono text-[10px] uppercase tracking-[.08em] text-muted">
                Déclaration à domicile
              </p>
              <p className="font-display text-3xl font-extrabold tabular-nums text-ink">
                {selected.declarations[0]}
              </p>
            </TickPlate>
            <TickPlate tick={false} className="bg-surface2">
              <p className="font-mono text-[10px] uppercase tracking-[.08em] text-muted">
                Déclaration à l’extérieur
              </p>
              <p className="font-display text-3xl font-extrabold tabular-nums text-ink">
                {selected.declarations[1]}
              </p>
            </TickPlate>
          </div>
        ) : null}

        {selected.blockedAmount ? (
          <p className="font-mono text-xs text-muted">
            Montant bloqué en séquestre : <span className="text-ink">{selected.blockedAmount}</span>
          </p>
        ) : null}

        <p className="text-sm text-muted">{selected.note}</p>

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={() => request('Demander une preuve')}>
            Demander une preuve
          </Button>
          {selected.declarations ? (
            <>
              <Button size="sm" variant="outline" onClick={() => request('Valider le score 3 – 2')}>
                Valider {selected.declarations[0]}
              </Button>
              <Button size="sm" variant="outline" onClick={() => request('Valider le score 2 – 3')}>
                Valider {selected.declarations[1]}
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => request('Annuler le match')}>
            Annuler le match
          </Button>
        </div>

        <p
          role="status"
          aria-live="polite"
          className={cn('text-xs', feedback ? 'text-ink' : 'sr-only')}
        >
          {feedback}
        </p>
      </TickPlate>
    </div>
  );
}
