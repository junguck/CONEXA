'use client';

import { Button, Card } from '@conexa/ui';
import Link from 'next/link';
import { useState } from 'react';

import { Hint, TopBar } from '../../../../shell/maquettes/kit';

const TAGS = ['Bonne conversation', 'Lieu agréable', 'À refaire', 'Pas d’alchimie'];

export default function MeetFeedbackPage() {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex flex-1 flex-col gap-4 pb-4">
        <TopBar title="Merci" back="/meet/dates" />
        <Card className="flex flex-col gap-2">
          <p className="font-display text-lg font-bold">Retour enregistré</p>
          <p className="text-sm text-muted">
            Ce retour reste privé. Il aide à améliorer les propositions ; il ne change pas la note
            publique de la personne et n’est jamais partagé avec le restaurant.
          </p>
        </Card>
        <Button asChild block>
          <Link href="/meet/dates">Retour à mes dates</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Comment s’est passé le date ?"
        back="/meet/dates"
        eyebrow="Nadia · Chez Tantie"
      />

      <Card className="flex flex-col gap-3">
        <p className="text-sm text-muted">Une note, sans commentaire public.</p>
        <div className="flex gap-1.5" role="group" aria-label="Note du date">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={rating === value}
              aria-label={`${value} sur 5`}
              onClick={() => setRating(value)}
              className={`h-12 flex-1 rounded-token border text-sm font-bold ${
                rating >= value
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line text-muted'
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={tags.includes(tag)}
              onClick={() =>
                setTags((current) =>
                  current.includes(tag)
                    ? current.filter((item) => item !== tag)
                    : [...current, tag],
                )
              }
              className={`min-h-11 rounded-full border px-3 text-xs font-semibold ${
                tags.includes(tag) ? 'border-accent text-accent-text' : 'border-line text-ink'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <Button block disabled={rating === 0} onClick={() => setSent(true)}>
          Envoyer mon retour
        </Button>
      </Card>

      <Hint>
        Le retour est facultatif et anonyme. Un signalement de comportement passe par Moi →
        Sécurité, jamais par la note.
      </Hint>
    </div>
  );
}
