import { Avatar, Badge, Button, Card } from '@conexa/ui';
import Link from 'next/link';

import { network } from '../../../../shell/maquettes/data';
import { Hint, TopBar } from '../../../../shell/maquettes/kit';

export default function ProNetworkPage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar
        title="Mon réseau"
        back="/pro"
        eyebrow="Invitations · 2 cette semaine"
        right={<Badge tone="accent">Limite 3</Badge>}
      />

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Invitations reçues
        </h2>
        <Card className="flex items-center gap-3">
          <Avatar name="Léa N." />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Léa N.</p>
            <p className="text-xs text-muted">Mathématiques · L2 · Tutrice vérifiée</p>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm">Accepter</Button>
            <Button size="sm" variant="ghost">
              Plus tard
            </Button>
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Suggestions
        </h2>
        {network.map((person) => (
          <div
            key={person.name}
            className="flex min-h-16 items-center gap-3 border-b border-line py-2.5 last:border-0"
          >
            <Avatar name={person.name} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{person.name}</p>
              <p className="truncate text-xs text-muted">{person.headline}</p>
              <p className="text-[11px] text-muted">{person.mutual} relations en commun</p>
            </div>
            <Button size="sm" variant="outline">
              Inviter
            </Button>
          </div>
        ))}
      </section>

      <Link
        href="/pro/emplois"
        className="text-sm font-semibold text-accent-text underline-offset-4 hover:underline"
      >
        Voir les missions proches de mes compétences
      </Link>

      <Hint>Les invitations sont limitées par semaine. Chaque publication peut être signalée.</Hint>
    </div>
  );
}
