'use client';

import { Badge, Button, Card, Input } from '@conexa/ui';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Hint, Photo, TopBar } from './kit';

const INTERESTS = ['Cuisine', 'Football', 'Voyages', 'Musique', 'Lecture', 'Bénévolat'];

export function MeetProfileEditor() {
  const [photos, setPhotos] = useState<Array<1 | 2 | 3>>([1, 2]);
  const [headline, setHeadline] = useState('Gestion · L3 · Douala');
  const [prompt, setPrompt] = useState(
    'Le date parfait : un plat simple et une vraie conversation.',
  );
  const [interests, setInterests] = useState(['Cuisine', 'Football', 'Voyages']);
  const [status, setStatus] = useState('');

  function toggleInterest(interest: string) {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : current.length >= 5
          ? current
          : [...current, interest],
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Mon profil Meet"
        back="/me"
        eyebrow="Visible quand vous vous êtes mutuellement choisis"
      />

      <div className="grid grid-cols-3 gap-2">
        {photos.map((variant, index) => (
          <div key={`${variant}-${index}`} className="relative">
            <Photo name="Brice Junguck" variant={variant} className="h-28 w-full" />
            <button
              type="button"
              aria-label={`Retirer la photo ${index + 1}`}
              onClick={() =>
                setPhotos((current) => current.filter((_, position) => position !== index))
              }
              className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        {photos.length < 3 ? (
          <button
            type="button"
            onClick={() => setPhotos((current) => [...current, 3])}
            className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-panel border border-dashed border-line text-xs font-semibold text-muted"
          >
            <Plus className="h-5 w-5" aria-hidden /> Ajouter
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        {photos.length} / 3 photos · la première sert de couverture. Les photos sont vérifiées avant
        publication.
      </p>

      <Input
        label="Accroche"
        value={headline}
        onChange={(event) => setHeadline(event.target.value)}
        maxLength={60}
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">
          Question · le date parfait
        </span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          maxLength={200}
          className="rounded-token border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink focus-visible:border-accent focus-visible:outline-none"
        />
        <span className="text-right font-mono text-[10px] text-muted">{prompt.length} / 200</span>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">
          Centres d’intérêt · {interests.length} / 5
        </span>
        <div className="flex flex-wrap gap-1.5">
          {INTERESTS.map((interest) => (
            <button
              key={interest}
              type="button"
              aria-pressed={interests.includes(interest)}
              onClick={() => toggleInterest(interest)}
              className={`min-h-11 rounded-full border px-3 text-xs font-semibold ${
                interests.includes(interest)
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line text-ink'
              }`}
            >
              {interest}
            </button>
          ))}
        </div>
      </div>

      <Card className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge tone="accent">Aperçu</Badge>
          <span className="text-xs text-muted">Ce que verront vos dates</span>
        </div>
        <div className="flex items-center gap-3">
          <Photo name="Brice Junguck" variant={1} className="h-16 w-16" />
          <div className="min-w-0">
            <p className="font-display text-base font-bold">Brice, 23</p>
            <p className="truncate text-xs text-muted">{headline}</p>
            <p className="truncate text-xs text-accent-text">{interests.join(' · ')}</p>
          </div>
        </div>
        <p className="text-sm text-ink">{prompt}</p>
      </Card>

      <Button
        block
        onClick={() =>
          setStatus('Profil enregistré localement. La modération vérifiera les photos.')
        }
      >
        Enregistrer
      </Button>
      <p role="status" aria-live="polite" className={status ? 'text-xs text-ok' : 'sr-only'}>
        {status}
      </p>

      <Hint>
        Aucun contact privé, aucune position exacte. Les photos sont visibles uniquement après un
        choix mutuel.
      </Hint>
    </div>
  );
}
