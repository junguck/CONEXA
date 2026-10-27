import type { HTMLAttributes } from 'react';

import { cn } from './cn';

type BadgeTone = 'neutral' | 'accent' | 'ok' | 'bad' | 'live';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface2 text-ink',
  accent: 'bg-surface2 text-accent-text',
  ok: 'bg-surface2 text-ok',
  bad: 'bg-surface2 text-bad',
  live: 'bg-live text-white',
};

/** Étiquette courte : l'information ne repose jamais sur la seule couleur. */
export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
