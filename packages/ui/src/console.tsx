import type { ReactNode } from 'react';

import { cn } from './cn';

/**
 * Plaque de la maquette v1 (design/Convexa-sources-figma, `assets/convexa.css`) :
 * bords droits, repères d'angle à l'accent, option de coin coupé. Sert aux
 * consoles desktop, qui gardent l'identité Convexa v1 (DESIGN_HANDOFF.md §7).
 */
export function TickPlate({
  children,
  className,
  tick = true,
}: {
  children: ReactNode;
  className?: string;
  tick?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative rounded-[2px] border border-line bg-surface p-3.5',
        tick && 'cxa-tick',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Chiffre clé d'une console : libellé mono, valeur en display, unité discrète. */
export function StatPlate({
  label,
  value,
  unit,
  accent = false,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <TickPlate tick={accent} {...(className ? { className } : {})}>
      <p className="font-mono text-[10px] uppercase tracking-[.12em] text-muted">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-3xl font-extrabold tabular-nums leading-none tracking-tight',
          accent ? 'text-accent-text' : 'text-ink',
        )}
      >
        {value}
      </p>
      {unit ? <p className="mt-1 text-xs text-muted">{unit}</p> : null}
    </TickPlate>
  );
}

/** En-tête de page : titre display et zone d'actions (puces, filtres, boutons). */
export function ConsoleHeading({
  title,
  children,
  aside,
}: {
  title: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <h1 className="min-w-0 flex-1 font-display text-2xl font-extrabold uppercase leading-tight tracking-tight text-ink">
        {title}
      </h1>
      {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
      {children}
    </div>
  );
}

export function ConsoleChips({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {children}
    </div>
  );
}

/** Puce de filtre : un `<button>` ou un `<a>` fourni par l'écran. */
export const chipClass =
  'inline-flex min-h-11 items-center gap-1.5 rounded-[2px] border border-line px-3.5 font-mono text-xs uppercase tracking-[.08em] text-ink aria-[current=true]:border-accent aria-[current=true]:bg-accent aria-[current=true]:font-bold aria-[current=true]:text-accent-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:font-bold aria-pressed:text-accent-ink';

/** Encart d'information, bordé à gauche, sans couleur porteuse de sens seule. */
export function ConsoleNotice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'ok' | 'warn' | 'bad';
}) {
  const tones = {
    info: 'border-accent bg-surface2',
    ok: 'border-ok bg-surface2',
    warn: 'border-live bg-surface2',
    bad: 'border-bad bg-surface2',
  } as const;
  return (
    <p className={cn('border-l-[3px] px-3.5 py-3 text-sm text-ink', tones[tone])}>{children}</p>
  );
}
