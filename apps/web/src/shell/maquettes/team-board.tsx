'use client';

import { Badge, Button, Card, Input } from '@conexa/ui';
import { useState } from 'react';

import { squad, teamRequests } from './data';
import { Crest, Hint, TopBar } from './kit';

export function TeamBoard() {
  const [roster, setRoster] = useState(squad);
  const [requests, setRequests] = useState(teamRequests);
  const [invite, setInvite] = useState('');
  const [status, setStatus] = useState('');

  function toggleAvailability(number: number) {
    setRoster((current) =>
      current.map((player) =>
        player.number === number ? { ...player, available: !player.available } : player,
      ),
    );
  }

  function answer(id: string, accepted: boolean, name: string) {
    setRequests((current) => current.filter((request) => request.id !== id));
    setStatus(
      accepted
        ? `${name} rejoint l’effectif. Le capitaine confirme le numéro de maillot.`
        : `${name} est prévenu, sans relance automatique.`,
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <TopBar title="Info Lions" back="/football" right={<Badge tone="ok">Recrute</Badge>} />

      <Card className="flex items-center gap-3">
        <Crest code="IL" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold">Info Lions</p>
          <p className="text-xs text-muted">Filière Informatique · Ligue Inter-filières</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-bold text-accent-text">1180</p>
          <p className="text-[10px] uppercase tracking-[.06em] text-muted">Elo</p>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Classement', value: '4e école' },
          { label: 'Filière', value: '1er' },
          { label: 'Bilan', value: '8V 2N 2D' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-token border border-line bg-surface px-2 py-3 text-center"
          >
            <p className="font-mono text-sm font-bold text-ink">{stat.value}</p>
            <p className="text-[10px] uppercase tracking-[.05em] text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-1">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Effectif · {roster.length} joueurs
        </h2>
        {roster.map((player) => (
          <div
            key={player.number}
            className="flex min-h-12 items-center gap-3 border-b border-line last:border-0"
          >
            <span className="w-7 text-center font-mono text-sm font-bold text-muted">
              {player.number}
            </span>
            <span className="flex-1 text-sm font-semibold">{player.name}</span>
            <span className="text-xs text-muted">{player.role}</span>
            <button
              type="button"
              aria-pressed={player.available}
              aria-label={`${player.name} : ${player.available ? 'disponible' : 'indisponible'}`}
              onClick={() => toggleAvailability(player.number)}
              className={`min-h-9 rounded-full border px-2.5 text-[10px] font-bold uppercase ${
                player.available ? 'border-ok text-ok' : 'border-line text-muted'
              }`}
            >
              {player.available ? 'Dispo' : 'Absent'}
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Demandes d’adhésion · {requests.length}
        </h2>
        {requests.length === 0 ? (
          <p className="text-sm text-muted">Aucune demande en attente.</p>
        ) : null}
        {requests.map((request) => (
          <Card key={request.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{request.name}</p>
              <Badge tone="neutral">{request.position}</Badge>
            </div>
            <p className="text-xs text-muted">{request.level}</p>
            <p className="text-xs text-muted">{request.note}</p>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={() => answer(request.id, true, request.name)}>
                Accepter
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => answer(request.id, false, request.name)}
              >
                Refuser
              </Button>
            </div>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Inviter un joueur
        </h2>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const name = invite.trim();
            if (name === '') return;
            setStatus(`Invitation envoyée à ${name}. La personne peut refuser sans justification.`);
            setInvite('');
          }}
        >
          <div className="flex-1">
            <Input
              label="Nom ou identifiant étudiant"
              value={invite}
              onChange={(event) => setInvite(event.target.value)}
              placeholder="Prénom N."
            />
          </div>
          <Button type="submit" size="sm">
            Inviter
          </Button>
        </form>
        <p role="status" aria-live="polite" className={status ? 'text-xs text-ink' : 'sr-only'}>
          {status}
        </p>
      </section>

      <Hint>
        Effectif minimum : 7 joueurs. Après un départ, un joueur attend 7 jours avant de rejoindre
        une autre équipe.
      </Hint>
    </div>
  );
}
