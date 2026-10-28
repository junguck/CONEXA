'use client';

import { Badge, Button, Card, Select } from '@conexa/ui';
import Link from 'next/link';
import { useState } from 'react';

import { Hint, TopBar } from './kit';

const REASONS = [
  { value: 'score', label: 'Score différent de la réalité' },
  { value: 'joueur', label: 'Joueur non qualifié' },
  { value: 'terrain', label: 'Terrain ou horaire non respecté' },
];

export function DisputeForm() {
  const [reason, setReason] = useState('score');
  const [details, setDetails] = useState('');
  const [proof, setProof] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex flex-1 flex-col gap-4 pb-4">
        <TopBar title="Désaccord envoyé" back="/football/match" />
        <Card className="flex flex-col gap-2">
          <Badge tone="live">Litige ouvert</Badge>
          <p className="text-sm text-muted">
            Le match passe en revue. Les deux capitaines ont 48 h pour ajouter une preuve (photo du
            tableau, témoin). L’Elo ne bouge pas avant la décision d’un administrateur.
          </p>
          <Hint>Le résultat reste « non confirmé » et n’apparaît pas au classement.</Hint>
        </Card>
        <Button asChild block>
          <Link href="/football/chat">Prévenir le capitaine adverse</Link>
        </Button>
        <Button asChild block variant="ghost">
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
        setSent(true);
      }}
    >
      <TopBar
        title="Signaler un désaccord"
        back="/football/match"
        eyebrow="Info Lions – Droit United"
      />

      <Select label="Motif" value={reason} onValueChange={setReason} options={REASONS} />

      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">
          Ce qui s’est passé
        </span>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={4}
          maxLength={500}
          placeholder="Décris factuellement, sans insulte."
          className="rounded-token border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
        />
      </label>

      <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={proof}
          onChange={(event) => setProof(event.target.checked)}
          className="h-5 w-5 rounded border-line"
        />
        J’ai une preuve à joindre (photo ou témoin)
      </label>

      <Button block type="submit">
        Ouvrir le litige
      </Button>
      <Button asChild block variant="ghost">
        <Link href="/football/match">Plus tard</Link>
      </Button>

      <Hint>
        Un litige n’entraîne ni amende ni perte de points automatique. Un administrateur peut
        annuler le match.
      </Hint>
    </form>
  );
}
