import { cn } from '@conexa/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** En-tête d'écran : retour, titre, action facultative. */
export function TopBar({
  title,
  back,
  right,
  eyebrow,
}: {
  title: string;
  back?: string;
  right?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="flex min-h-14 items-center gap-2 py-2">
      {back ? (
        <Link
          href={back}
          aria-label="Retour"
          className="-ml-2 flex h-11 w-11 flex-none items-center justify-center rounded-token text-ink hover:bg-surface2"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {eyebrow ? (
          <span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="truncate font-display text-xl font-bold leading-tight text-ink">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Écusson d'équipe : carré coloré avec le code, jamais la couleur seule. */
export function Crest({ code, tone = 1 }: { code: string; tone?: 1 | 2 | 3 | 4 | 5 }) {
  const tones = ['bg-[#1F6FEB]', 'bg-[#D63B3B]', 'bg-[#2FA66A]', 'bg-[#8F4FD6]', 'bg-[#E58A1F]'];
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-6 w-6 flex-none items-center justify-center rounded-[4px] font-mono text-[10px] font-bold text-white',
        tones[(tone - 1) % tones.length],
      )}
    >
      {code}
    </span>
  );
}

export function MatchRow({
  home,
  away,
  homeCode,
  awayCode,
  scoreHome,
  scoreAway,
  time,
  live,
}: {
  home: string;
  away: string;
  homeCode: string;
  awayCode: string;
  scoreHome: number | null;
  scoreAway: number | null;
  time: string;
  live?: boolean;
}) {
  return (
    <div className="grid grid-cols-[52px_1fr_auto] items-center gap-2 border-b border-line py-3 last:border-0">
      <span
        className={cn(
          'text-center font-mono text-xs font-semibold',
          live ? 'animate-blinkdot text-live' : 'text-muted',
        )}
      >
        {time}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Crest code={homeCode} tone={1} /> <span className="truncate">{home}</span>
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Crest code={awayCode} tone={2} /> <span className="truncate">{away}</span>
        </span>
      </div>
      <div
        className={cn(
          'flex flex-col gap-1.5 text-right font-mono text-base font-bold',
          live ? 'text-live' : 'text-ink',
        )}
      >
        <span>{scoreHome ?? '–'}</span>
        <span>{scoreAway ?? '–'}</span>
      </div>
    </div>
  );
}

export function Photo({
  name,
  variant = 1,
  className,
  label,
}: {
  name: string;
  variant?: 1 | 2 | 3;
  className?: string;
  label?: string;
}) {
  const gradients = [
    'linear-gradient(160deg,#FFB199 0%,#FF6B8B 55%,#B4308A 100%)',
    'linear-gradient(160deg,#8EE3FF 0%,#5078F0 60%,#2C2A8F 100%)',
    'linear-gradient(140deg,#B6E3C4 0%,#4CB89A 60%,#1F5E4C 100%)',
  ];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return (
    <span
      role="img"
      aria-label={label ?? name}
      className={cn('relative inline-flex flex-none overflow-hidden rounded-panel', className)}
      style={{ background: gradients[(variant - 1) % gradients.length] }}
    >
      <span className="absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center font-display text-3xl font-bold text-white/85">
        {initials}
      </span>
    </span>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted">{children}</p>;
}

export function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-token border-[1.5px] border-line bg-surface px-3.5 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[.06em] text-muted">
        {label}
      </span>
      <span className="text-[15px] font-semibold text-ink">{value}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function Toggle({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick?: () => void;
}) {
  const track = cn(
    'relative h-7 w-[46px] flex-none rounded-full border',
    on ? 'border-accent bg-accent' : 'border-line bg-surface2',
  );
  const knob = cn(
    'absolute top-[3px] h-5 w-5 rounded-full',
    on ? 'left-[21px] bg-accent-ink' : 'left-[3px] bg-muted',
  );

  if (!onClick) {
    return (
      <span className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-sm text-ink">{label}</span>
        <span aria-label={`${label} : ${on ? 'activé' : 'désactivé'}`} role="img" className={track}>
          <span className={knob} />
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="flex min-h-11 items-center justify-between gap-3 text-left"
    >
      <span className="text-sm text-ink">{label}</span>
      <span aria-hidden className={track}>
        <span className={knob} />
      </span>
    </button>
  );
}
