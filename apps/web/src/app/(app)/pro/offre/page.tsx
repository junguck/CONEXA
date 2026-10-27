'use client';

import { Badge, Button, Card } from '@conexa/ui';
import Link from 'next/link';
import { useState } from 'react';

import { jobs } from '../../../../shell/maquettes/data';
import { Hint, TopBar } from '../../../../shell/maquettes/kit';

const job = jobs[0]!;

export default function JobPage() {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title={job.title} back="/pro/emplois" eyebrow={job.org} />

      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{job.budget}</Badge>
          <span className="font-mono text-xs text-muted">Clôture dans {job.deadline}</span>
        </div>
        <p className="text-sm text-muted">
          Recherche d’une personne pour livrer la première version d’un module de covoiturage entre
          étudiants. Travail à distance, deux points de suivi par semaine, code relu avant mise en
          production.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {job.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-line px-2.5 py-1 text-xs">
              {tag}
            </span>
          ))}
        </div>
        <Hint>
          Paiement via le séquestre Convexa : libéré quand les deux parties confirment la livraison.
          Aucun partage de contact avant accord.
        </Hint>
      </Card>

      {sent ? (
        <Card className="flex flex-col gap-2">
          <Badge tone="ok">Candidature envoyée</Badge>
          <p className="text-sm text-muted">
            {job.org} reçoit ton message. La réponse arrive dans l’application ; aucune coordonnée
            privée n’est échangée avant accord mutuel.
          </p>
          <Button asChild variant="outline" block>
            <Link href="/pro/emplois">Voir d’autres missions</Link>
          </Button>
        </Card>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (message.trim().length < 20) {
              setError('Décris en quelques lignes ce que tu proposes (20 caractères minimum).');
              return;
            }
            setError('');
            setSent(true);
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">
              Ton message
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              maxLength={600}
              placeholder="Expérience, disponibilité, questions…"
              className="rounded-token border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
            />
          </label>
          {error ? (
            <p role="alert" className="text-xs text-bad">
              {error}
            </p>
          ) : null}
          <Button block type="submit">
            Envoyer ma candidature
          </Button>
          <Button asChild block variant="ghost">
            <Link href="/pro/emplois">Plus tard</Link>
          </Button>
        </form>
      )}
    </div>
  );
}
