import { Badge } from '@conexa/ui';

import { matches } from '../../../shell/maquettes/data';
import { Hint, MatchRow, TopBar } from '../../../shell/maquettes/kit';

const days = [
  { label: 'Jeu', value: '22' },
  { label: 'Ven', value: '23' },
  { label: 'Auj.', value: '24' },
  { label: 'Dim', value: '25' },
  { label: 'Lun', value: '26' },
];

export default function FootScoresPage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Scores"
        eyebrow="Ligue Inter-filières"
        right={<Badge tone="live">Direct</Badge>}
      />

      <div className="grid grid-cols-5 gap-1.5" aria-label="Jours">
        {days.map((day) => (
          <div
            key={day.label}
            className={`flex min-h-14 flex-col items-center justify-center rounded-token text-[11px] font-semibold uppercase ${
              day.label === 'Auj.' ? 'bg-accent text-accent-ink' : 'text-muted'
            }`}
          >
            <span>{day.label}</span>
            <span className="font-mono text-lg font-bold leading-none">{day.value}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {['Tous', 'En direct', 'Mes équipes'].map((filter, index) => (
          <span
            key={filter}
            className={`inline-flex min-h-9 flex-none items-center rounded-full border px-3.5 text-sm font-semibold ${
              index === 0 ? 'border-ink bg-ink text-bg' : 'border-line text-ink'
            }`}
          >
            {filter}
          </span>
        ))}
      </div>

      <section className="flex flex-col">
        <div className="flex items-center gap-2 bg-surface2 px-1 py-2 text-[11px] font-bold uppercase tracking-[.06em] text-muted">
          <span className="h-4 w-4 rounded-[3px] bg-accent" aria-hidden /> Poule A
        </div>
        {matches.map((match) => (
          <MatchRow key={`${match.home}-${match.away}`} {...match} />
        ))}
      </section>

      <section className="flex flex-col">
        <div className="flex items-center gap-2 bg-surface2 px-1 py-2 text-[11px] font-bold uppercase tracking-[.06em] text-muted">
          <span className="h-4 w-4 rounded-[3px] bg-accent" aria-hidden /> Coupe du Campus
        </div>
        <MatchRow
          home="Polytech"
          away="Droit United"
          homeCode="PO"
          awayCode="DU"
          scoreHome={0}
          scoreAway={0}
          time="23'"
          live
        />
        <MatchRow
          home="Lettres FC"
          away="Info Lions"
          homeCode="LF"
          awayCode="IL"
          scoreHome={1}
          scoreAway={4}
          time="FT"
        />
      </section>

      <Hint>Les scores des matchs de campus sont confirmés par les deux capitaines.</Hint>
    </div>
  );
}
