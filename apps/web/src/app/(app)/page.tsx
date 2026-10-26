import { Badge, Card } from '@conexa/ui';
import { ArrowRight, BriefcaseBusiness, Heart, Trophy } from 'lucide-react';
import Link from 'next/link';

import { matches, me } from '../../shell/maquettes/data';
import { Crest, Photo, SectionTitle } from '../../shell/maquettes/kit';

export default function HomePage() {
  const live = matches[0]!;

  return (
    <div className="flex flex-col gap-5 pb-4 pt-1">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[.14em] text-muted">
            Samedi 24 octobre
          </p>
          <h1 className="font-display text-[2rem] font-bold leading-tight">Salut {me.firstName}</h1>
        </div>
        <Photo name={me.fullName} variant={2} className="h-11 w-11 rounded-full" />
      </div>

      <section className="flex flex-col gap-2">
        <SectionTitle
          action={
            <Link href="/football" className="text-xs font-semibold text-accent-text">
              Tout voir
            </Link>
          }
        >
          Football
        </SectionTitle>
        <Link href="/football/match" className="block">
          <Card className="flex flex-col gap-3 border-line bg-surface">
            <div className="flex items-center justify-between">
              <Badge tone="live">Direct</Badge>
              <span className="font-mono text-xs text-muted">Ligue Inter-filières</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <Crest code={live.homeCode} /> <span className="truncate">{live.home}</span>
              </span>
              <span className="font-mono text-2xl font-bold text-live">
                {live.scoreHome} – {live.scoreAway}
              </span>
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <span className="truncate">{live.away}</span>{' '}
                <Crest code={live.awayCode} tone={2} />
              </span>
            </div>
            <p className="text-xs text-muted">
              {live.time} · ton match : dim. 16:00 contre Droit United
            </p>
          </Card>
        </Link>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle
          action={
            <Link href="/meet" className="text-xs font-semibold text-accent-text">
              Ouvrir
            </Link>
          }
        >
          <span className="inline-flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" aria-hidden /> Meet
          </span>
        </SectionTitle>
        <Link href="/meet" className="block">
          <Card className="flex items-center gap-3">
            <div className="flex -space-x-3">
              {['MB', 'AM', 'KT'].map((initials, index) => (
                <span
                  key={initials}
                  aria-hidden
                  className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-surface bg-surface2 font-display text-xs font-bold text-accent-text"
                  style={{ zIndex: 3 - index }}
                >
                  {initials}
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">3 propositions t’attendent</p>
              <p className="text-xs text-muted">3 par semaine, sans achat supplémentaire.</p>
            </div>
            <ArrowRight className="h-5 w-5 flex-none text-accent-text" aria-hidden />
          </Card>
        </Link>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle
          action={
            <Link href="/pro" className="text-xs font-semibold text-accent-text">
              Ouvrir
            </Link>
          }
        >
          <span className="inline-flex items-center gap-1.5">
            <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden /> Réseau Pro
          </span>
        </SectionTitle>
        <Link href="/pro" className="block">
          <Card className="flex flex-col gap-2">
            <p className="text-sm font-semibold">2 invitations</p>
            <p className="text-sm text-ink">1 mission proche de tes compétences</p>
            <p className="text-sm text-muted">3 nouvelles publications</p>
            <span className="text-xs text-accent-text">Voir le fil</span>
          </Card>
        </Link>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Dimanche 16:00</SectionTitle>
        <Card className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-accent-text" aria-hidden />
          <p className="text-sm text-ink">Match · Stade A · terrain principal</p>
        </Card>
        <p className="text-xs leading-relaxed text-muted">
          Les trois univers ont chacun leur look. La barre du bas te ramène ici, au centre.
        </p>
      </section>

      <Link
        href="/design"
        className="self-start text-xs font-semibold text-accent-text underline-offset-4 hover:underline"
      >
        Voir le design system
      </Link>
    </div>
  );
}
