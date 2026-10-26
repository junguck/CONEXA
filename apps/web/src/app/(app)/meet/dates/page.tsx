import { Badge, Card } from '@conexa/ui';
import Link from 'next/link';

import { dates } from '../../../../shell/maquettes/data';
import { Hint, Photo, TopBar } from '../../../../shell/maquettes/kit';

export default function MeetDatesPage() {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title="Mes dates" back="/meet" eyebrow="Rencontres" />

      {dates.map((date) => (
        <Link key={date.name} href="/meet/jour" className="block">
          <Card className="flex items-center gap-3">
            <Photo name={date.name} variant={date.variant} className="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold">{date.name}</p>
              <p className="truncate text-xs text-muted">
                {date.restaurant} · {date.when}
              </p>
              <p className="mt-1 font-mono text-xs text-ink">{date.amount} · séquestre</p>
            </div>
            <Badge tone={date.status === 'Confirmé' ? 'ok' : 'accent'}>{date.status}</Badge>
          </Card>
        </Link>
      ))}

      <Hint>
        Annulation gratuite jusqu’à 3 h avant le date. Le montant est visible avant paiement, sans
        frais caché.
      </Hint>
    </div>
  );
}
