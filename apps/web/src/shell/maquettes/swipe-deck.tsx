'use client';

import { Button } from '@conexa/ui';
import { Heart, MapPin, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

import { picks } from './data';
import { Photo } from './kit';

type Pick = (typeof picks)[number];

const THRESHOLD = 96;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    document.documentElement.dataset['reducedMotion'] === 'true' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Deck Meet : glisser à droite = inviter, à gauche = passer (DESIGN_HANDOFF §4).
 * Les boutons restent obligatoires : le geste est un raccourci, pas l'unique
 * moyen. Les flèches du clavier font la même chose quand la carte a le focus.
 */
export function SwipeDeck({ items = picks }: { items?: readonly Pick[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [exit, setExit] = useState<'left' | 'right' | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const lastX = useRef(0);

  const current = items[index];
  const next = items[index + 1];

  const decide = useCallback(
    (direction: 'left' | 'right') => {
      if (!current || exit) return;
      setExit(direction);
      const delay = prefersReducedMotion() ? 0 : 200;
      window.setTimeout(() => {
        setExit(null);
        setDrag({ x: 0, y: 0 });
        if (direction === 'right') {
          router.push('/meet/match');
          return;
        }
        setIndex((value) => value + 1);
      }, delay);
    },
    [current, exit, router],
  );

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-panel border border-line bg-surface px-6 py-12 text-center">
        <p className="font-display text-lg font-bold">Tes 3 propositions de la semaine sont vues</p>
        <p className="text-sm text-muted">
          De nouvelles propositions arrivent lundi. Aucun achat ne permet d’en obtenir plus.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/meet/dates">Voir mes dates</Link>
        </Button>
      </div>
    );
  }

  const rotation = exit === 'left' ? -18 : exit === 'right' ? 18 : drag.x / 16;
  const offset = exit ? (exit === 'left' ? -520 : 520) : drag.x;
  const hint = drag.x > THRESHOLD ? 'Inviter' : drag.x < -THRESHOLD ? 'Passer' : '';

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex-1 select-none" style={{ minHeight: '26rem' }}>
        {next ? (
          <div className="absolute inset-0 translate-y-2 scale-[.96] overflow-hidden rounded-panel border border-line bg-surface opacity-70">
            <Photo name={next.name} variant={next.variant} className="h-full w-full" />
          </div>
        ) : null}

        <div
          role="group"
          aria-roledescription="carte de rencontre"
          aria-label={`${current.name}, ${index + 1} sur ${items.length}`}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') decide('right');
            if (event.key === 'ArrowLeft') decide('left');
          }}
          onPointerDown={(event) => {
            start.current = { x: event.clientX, y: event.clientY };
            lastX.current = 0;
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // Pointeur synthétique ou déjà relâché : le geste reste utilisable.
            }
          }}
          onPointerMove={(event) => {
            if (!start.current) return;
            const delta = event.clientX - start.current.x;
            lastX.current = delta;
            setDrag({ x: delta, y: event.clientY - start.current.y });
          }}
          onPointerUp={() => {
            start.current = null;
            const delta = lastX.current;
            lastX.current = 0;
            if (delta > THRESHOLD) decide('right');
            else if (delta < -THRESHOLD) decide('left');
            else setDrag({ x: 0, y: 0 });
          }}
          onPointerCancel={() => {
            start.current = null;
            lastX.current = 0;
            setDrag({ x: 0, y: 0 });
          }}
          className="absolute inset-0 touch-pan-y overflow-hidden rounded-panel border border-line bg-surface shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{
            transform: `translate3d(${offset}px, ${drag.y}px, 0) rotate(${rotation}deg)`,
            transition: drag.x === 0 && !start.current ? 'transform .2s ease-out' : 'none',
          }}
        >
          <Photo
            name={current.name}
            variant={current.variant}
            className="absolute inset-0 h-full w-full"
          />
          <span className="absolute right-3 top-3 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            {current.compatibility}
          </span>
          {hint ? (
            <span className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 font-mono text-xs uppercase tracking-[.1em] text-white">
              {hint}
            </span>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-16 text-white">
            <p className="font-display text-4xl font-bold leading-none">
              {current.name} <span className="text-2xl font-normal">{current.age}</span>
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/90">
              {current.filiere} · {current.level} <span aria-hidden>·</span>
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {current.distance}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {current.traits.map((trait) => (
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
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {hint ? `Relâchez pour ${hint.toLowerCase()}` : `Carte ${index + 1} sur ${items.length}`}
      </p>

      <div className="flex items-center justify-center gap-6 py-1">
        <button
          type="button"
          aria-label={`Passer ${current.name}`}
          onClick={() => decide('left')}
          className="flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-line bg-surface text-ink shadow-md"
        >
          <X className="h-6 w-6" aria-hidden />
        </button>
        <Button className="h-[4.25rem] rounded-full px-7" onClick={() => decide('right')}>
          <Heart className="h-5 w-5" aria-hidden /> Inviter
        </Button>
      </div>
    </div>
  );
}
