'use client';

import { Badge, Button, Card, Input } from '@conexa/ui';
import Link from 'next/link';
import { useState } from 'react';

import { Crest, Hint, TopBar } from '../../../../shell/maquettes/kit';

export default function ScorePage() {
  const [home, setHome] = useState('2');
  const [away, setAway] = useState('1');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <TopBar
        title="Déclarer le score"
        back="/football/match"
        eyebrow="Info Lions – Droit United · terminé"
      />

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <Crest code="IL" />
            <span className="text-xs font-semibold">Info Lions</span>
          </div>
          <span className="font-mono text-sm text-muted">–</span>
          <div className="flex flex-col items-center gap-1.5">
            <Crest code="DU" tone={2} />
            <span className="text-xs font-semibold">Droit United</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Buts Info Lions"
            type="number"
            inputMode="numeric"
            min={0}
            max={30}
            value={home}
            onChange={(event) => setHome(event.target.value)}
            disabled={submitted}
          />
          <Input
            label="Buts Droit United"
            type="number"
            inputMode="numeric"
            min={0}
            max={30}
            value={away}
            onChange={(event) => setAway(event.target.value)}
            disabled={submitted}
          />
        </div>

        {submitted ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="live">Non confirmé</Badge>
              <span className="font-mono text-xs text-muted">
                ta déclaration : {home} – {away}
              </span>
            </div>
            <p className="text-sm text-muted">
              Le capitaine adverse doit confirmer. En cas de désaccord, le match passe en litige et
              un administrateur tranche. L’Elo ne bouge qu’après accord des deux capitaines.
            </p>
          </div>
        ) : (
          <Hint>
            Ta déclaration part telle quelle. Aucun score n’est publié comme « confirmé » avant
            l’accord des deux capitaines.
          </Hint>
        )}

        {submitted ? (
          <Button variant="outline" block onClick={() => setSubmitted(false)}>
            Corriger ma déclaration
          </Button>
        ) : (
          <Button block onClick={() => setSubmitted(true)}>
            Envoyer ma déclaration
          </Button>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        <Button asChild block variant="outline">
          <Link href="/football/match">Revenir au match</Link>
        </Button>
        <Hint>
          Un score contesté ouvre un litige : les deux équipes peuvent joindre une photo du tableau
          dans les 48 h.
        </Hint>
      </div>
    </div>
  );
}
