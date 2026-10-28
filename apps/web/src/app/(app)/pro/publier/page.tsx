'use client';

import { Badge, Button, Card, Input } from '@conexa/ui';
import Link from 'next/link';
import { useState } from 'react';

import { Hint, TopBar } from '../../../../shell/maquettes/kit';

export default function ComposePage() {
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [published, setPublished] = useState(false);
  const [error, setError] = useState('');

  if (published) {
    return (
      <div className="flex flex-1 flex-col gap-4 pb-4">
        <TopBar title="Publication envoyée" back="/pro" />
        <Card className="flex flex-col gap-2">
          <Badge tone="ok">Visible sur ton réseau</Badge>
          <p className="text-sm text-ink">{body}</p>
          {tags ? (
            <p className="text-xs text-accent-text">
              {tags
                .split(',')
                .map((tag) => `#${tag.trim().replace(/^#/, '')}`)
                .join(' ')}
            </p>
          ) : null}
          <Hint>
            La publication peut être supprimée à tout moment. Chaque publication porte un bouton de
            signalement.
          </Hint>
        </Card>
        <Button asChild block>
          <Link href="/pro">Retour au fil</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (body.trim().length < 10) {
          setError('Écris au moins une phrase (10 caractères).');
          return;
        }
        setError('');
        setPublished(true);
      }}
    >
      <TopBar title="Publier" back="/pro" eyebrow="Réseau Pro · Léa N." />

      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">
          Message
        </span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={6}
          maxLength={1200}
          placeholder="Projet, recherche de coéquipiers, retour d’expérience…"
          className="rounded-token border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none"
        />
        <span className="text-right font-mono text-[10px] text-muted">{body.length} / 1200</span>
      </label>

      <Input
        label="Compétences (séparées par des virgules)"
        value={tags}
        onChange={(event) => setTags(event.target.value)}
        placeholder="NestJS, Figma, anglais"
      />

      <Hint>
        Pas de numéro de téléphone ni de contact privé dans le texte : le serveur masque les
        coordonnées. Les invitations sont limitées par semaine ; « Plus tard » reste toujours
        disponible.
      </Hint>

      {error ? (
        <p role="alert" className="text-xs text-bad">
          {error}
        </p>
      ) : null}

      <Button block type="submit">
        Publier
      </Button>
      <Button asChild block variant="ghost">
        <Link href="/pro">Annuler</Link>
      </Button>
    </form>
  );
}
