import { Crest, Hint, TopBar } from '../../../../shell/maquettes/kit';
import { standings } from '../../../../shell/maquettes/data';

export default function FootTablePage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Classement" back="/football" eyebrow="Ligue Inter-filières · Poule A" />

      <div className="flex gap-1.5">
        {['Poule A', 'Poule B', 'Général'].map((tab, index) => (
          <span
            key={tab}
            className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-semibold ${
              index === 0 ? 'border-ink bg-ink text-bg' : 'border-line text-ink'
            }`}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-panel border border-line bg-surface">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Classement de la Poule A</caption>
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-[.06em] text-muted">
              <th className="px-2 py-2 font-bold">#</th>
              <th className="px-2 py-2 font-bold">Équipe</th>
              <th className="px-1 py-2 text-center font-bold">J</th>
              <th className="px-1 py-2 text-center font-bold">G</th>
              <th className="px-1 py-2 text-center font-bold">N</th>
              <th className="px-1 py-2 text-center font-bold">P</th>
              <th className="px-1 py-2 text-center font-bold">+/-</th>
              <th className="px-2 py-2 text-right font-bold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.team}
                className={`border-b border-line last:border-0 ${row.rank === 2 ? 'bg-surface2 shadow-[inset_3px_0_0_var(--ac)]' : ''}`}
              >
                <td className="px-2 py-2.5 font-mono font-bold text-muted">{row.rank}</td>
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-2 font-semibold">
                    <Crest code={row.code} tone={(row.rank % 5) as 1 | 2 | 3 | 4 | 5} />
                    <span className="truncate">{row.team}</span>
                  </span>
                </td>
                <td className="px-1 py-2.5 text-center font-mono">{row.played}</td>
                <td className="px-1 py-2.5 text-center font-mono">{row.won}</td>
                <td className="px-1 py-2.5 text-center font-mono">{row.drawn}</td>
                <td className="px-1 py-2.5 text-center font-mono">{row.lost}</td>
                <td className="px-1 py-2.5 text-center font-mono">{row.goals}</td>
                <td className="px-2 py-2.5 text-right font-mono text-base font-bold">
                  {row.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Hint>
        Victoire 3 points, nul 1 point. Un match non confirmé par les deux capitaines ne compte pas.
      </Hint>
    </div>
  );
}
