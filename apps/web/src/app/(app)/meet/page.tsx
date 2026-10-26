import { Button } from '@conexa/ui';
import { Heart, MapPin, X } from 'lucide-react';

import { picks } from '../../../shell/maquettes/data';
import { Hint, Photo, TopBar } from '../../../shell/maquettes/kit';

export default function MeetSwipePage() {
  const pick = picks[0]!;

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Meet"
        eyebrow="2 / 3 cette semaine"
        right={<span className="font-mono text-xs text-muted">3 max</span>}
      />

      <div className="relative flex-1 overflow-hidden rounded-panel" style={{ minHeight: '26rem' }}>
        <Photo name={pick.name} variant={1} className="absolute inset-0 h-full w-full" />
        <span className="absolute right-3 top-3 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          {pick.compatibility}
        </span>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-16 text-white">
          <p className="font-display text-4xl font-bold leading-none">
            {pick.name} <span className="text-2xl font-normal">{pick.age}</span>
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/90">
            {pick.filiere} · {pick.level} <span aria-hidden>·</span>
            <MapPin className="h-3.5 w-3.5" aria-hidden /> {pick.distance}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {pick.traits.map((trait) => (
              <span
                key={trait}
                className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur"
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 py-1">
        <button
          type="button"
          aria-label={`Passer ${pick.name}`}
          className="flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-line bg-surface text-ink shadow-md"
        >
          <X className="h-6 w-6" aria-hidden />
        </button>
        <Button className="h-[4.25rem] rounded-full px-7">
          <Heart className="h-5 w-5" aria-hidden /> Inviter
        </Button>
      </div>

      <Hint>
        Inviter propose un repas dans un restaurant partenaire. Rien n’est payé avant que vous soyez
        d’accord. 3 propositions par semaine, aucun achat pour en avoir plus.
      </Hint>
    </div>
  );
}
