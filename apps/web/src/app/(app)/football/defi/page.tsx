'use client';

import { Button, Card, Input, Select } from '@conexa/ui';
import Link from 'next/link';
import { useState } from 'react';

import { Hint, TopBar } from '../../../../shell/maquettes/kit';

const TERRAINS = [
  { value: 'stade-a', label: 'Stade A · terrain principal' },
  { value: 'stade-b', label: 'Stade B · synthétique' },
  { value: 'gymnase', label: 'Gymnase couvert' },
];

export default function ChallengePage() {
  const [sent, setSent] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [terrain, setTerrain] = useState('stade-a');
  const [when, setWhen] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (sent) {
    return (
      <div className="flex flex-1 flex-col gap-4 pb-4">
        <TopBar title="Défi envoyé" back="/football" />
        <Card className="flex flex-col gap-2">
          <p className="font-display text-lg font-bold">En attente de {opponent}</p>
          <p className="text-sm text-muted">
            Le capitaine adverse reçoit le défi. Tant qu’il n’a pas accepté, le match n’est ni
            réservé ni compté au classement.
          </p>
          <Hint>Tu peux retirer le défi à tout moment depuis la fiche du match.</Hint>
        </Card>
        <Button asChild block>
          <Link href="/football">Retour aux scores</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (opponent.trim() === '' || when === '') {
          setError('Choisis une équipe adverse et une date.');
          return;
        }
        setError('');
        setSent(true);
      }}
    >
      <TopBar title="Lancer un défi" back="/football" eyebrow="Info Lions · capitaine" />

      <Input
        label="Équipe adverse"
        value={opponent}
        onChange={(event) => setOpponent(event.target.value)}
        placeholder="Génie Civil"
        hint="Seules les équipes inscrites cette saison apparaissent côté serveur."
      />
      <Select label="Terrain" value={terrain} onValueChange={setTerrain} options={TERRAINS} />
      <Input
        label="Date et heure"
        type="datetime-local"
        value={when}
        onChange={(event) => setWhen(event.target.value)}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">
          Message (facultatif)
        </span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          maxLength={280}
          placeholder="Terrain préféré, heure de repli…"
          className="rounded-token border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
        />
        <span className="text-xs text-muted">
          Aucun numéro de téléphone dans le message : la conversation des capitaines filtre les
          chiffres et les liens.
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-xs text-bad">
          {error}
        </p>
      ) : null}

      <Button block type="submit">
        Envoyer le défi
      </Button>
      <Button asChild block variant="ghost">
        <Link href="/football">Plus tard</Link>
      </Button>

      <Hint>
        Un défi accepté réserve le terrain ; annulation gratuite jusqu’à 24 h avant. Les deux
        capitaines devront confirmer le score.
      </Hint>
    </form>
  );
}
