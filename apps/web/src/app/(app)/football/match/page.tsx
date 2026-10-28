import { Badge, Button, Card } from '@conexa/ui';
import { Check } from 'lucide-react';
import Link from 'next/link';

import { Crest, Hint, TopBar } from '../../../../shell/maquettes/kit';

const events = [
  { minute: '12′', text: 'But · Kevin T. (Info Lions)', side: 'home' },
  { minute: '34′', text: 'Carton jaune · Samuel M. (Droit United)', side: 'away' },
  { minute: '51′', text: 'But · Aïcha K. (Droit United)', side: 'away' },
  { minute: '67′', text: 'But · Brice J. (Info Lions)', side: 'home' },
];

export default function FootMatchPage() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <TopBar
        title="Info Lions – Droit United"
        back="/football"
        eyebrow="Ligue Inter-filières · Poule A"
      />

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Badge tone="live">67′ en direct</Badge>
          <span className="font-mono text-xs text-muted">Stade A · terrain principal</span>
        </div>
        <div className="grid grid-cols-3 items-center gap-2 text-center">
          <div className="flex flex-col items-center gap-2">
            <Crest code="IL" />
            <span className="text-sm font-semibold">Info Lions</span>
          </div>
          <div className="font-mono text-4xl font-bold text-live">2–1</div>
          <div className="flex flex-col items-center gap-2">
            <Crest code="DU" tone={2} />
            <span className="text-sm font-semibold">Droit United</span>
          </div>
        </div>
      </Card>

      <section className="flex flex-col gap-1">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Faits du match
        </h2>
        {events.map((event) => (
          <div
            key={`${event.minute}-${event.text}`}
            className="grid grid-cols-[46px_1fr] items-center gap-2 border-b border-line py-3 last:border-0"
          >
            <span className="text-center font-mono text-sm font-bold text-muted">
              {event.minute}
            </span>
            <span className="text-sm text-ink">{event.text}</span>
          </div>
        ))}
      </section>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ok">
          <Check className="h-4 w-4" aria-hidden /> Ton capitaine a déclaré : 2 – 1
        </div>
        <Hint>Le classement ne bouge qu’après validation des deux capitaines.</Hint>
        <Button block size="sm" asChild>
          <Link href="/football/score">Déclarer le score</Link>
        </Button>
        <Button block size="sm" variant="outline" asChild>
          <Link href="/football/litige">Signaler un désaccord</Link>
        </Button>
        <Button block size="sm" variant="ghost" asChild>
          <Link href="/football/chat">Ouvrir le chat des capitaines</Link>
        </Button>
      </Card>
    </div>
  );
}
