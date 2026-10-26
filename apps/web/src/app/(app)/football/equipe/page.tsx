import { Badge, Button, Card } from '@conexa/ui';

import { Crest, Hint, TopBar } from '../../../../shell/maquettes/kit';

const squad = [
  { name: 'Kevin T.', role: 'Gardien', number: 1 },
  { name: 'Samuel M.', role: 'Défenseur', number: 4 },
  { name: 'Brice J.', role: 'Milieu', number: 8 },
  { name: 'Aïcha K.', role: 'Attaquante', number: 9 },
];

export default function FootTeamPage() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <TopBar title="Info Lions" back="/football" right={<Badge tone="ok">Recrute</Badge>} />

      <Card className="flex items-center gap-3">
        <Crest code="IL" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold">Info Lions</p>
          <p className="text-xs text-muted">Filière Informatique · Ligue Inter-filières</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-bold text-accent-text">1180</p>
          <p className="text-[10px] uppercase tracking-[.06em] text-muted">Elo</p>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Classement', value: '4e école' },
          { label: 'Filière', value: '1er' },
          { label: 'Bilan', value: '8V 2N 2D' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-token border border-line bg-surface px-2 py-3 text-center"
          >
            <p className="font-mono text-sm font-bold text-ink">{stat.value}</p>
            <p className="text-[10px] uppercase tracking-[.05em] text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-1">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Effectif · 9 joueurs
        </h2>
        {squad.map((player) => (
          <div
            key={player.number}
            className="flex min-h-12 items-center gap-3 border-b border-line last:border-0"
          >
            <span className="w-7 text-center font-mono text-sm font-bold text-muted">
              {player.number}
            </span>
            <span className="flex-1 text-sm font-semibold">{player.name}</span>
            <span className="text-xs text-muted">{player.role}</span>
          </div>
        ))}
      </section>

      <Hint>
        Effectif minimum : 7 joueurs. Après un départ, un joueur attend 7 jours avant de rejoindre
        une autre équipe.
      </Hint>
      <Button block>Demander à rejoindre</Button>
    </div>
  );
}
