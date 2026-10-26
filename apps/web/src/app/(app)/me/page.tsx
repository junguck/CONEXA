import { Badge, Button, Card } from '@conexa/ui';
import { Bell, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { me } from '../../../shell/maquettes/data';
import { AppearanceControls } from '../../../shell/maquettes/appearance-controls';
import { Photo, TopBar } from '../../../shell/maquettes/kit';

const universes = [
  { label: 'Mon équipe de foot', href: '/football/equipe' },
  { label: 'Mon profil Meet', href: '/meet/profil' },
  { label: 'Mon profil Pro', href: '/pro/profil' },
];

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <TopBar
        title="Moi"
        right={
          <Link
            href="/me/notifications"
            aria-label="Notifications"
            className="flex h-11 w-11 items-center justify-center rounded-token border border-line"
          >
            <Bell className="h-5 w-5" aria-hidden />
          </Link>
        }
      />

      <div className="flex items-center gap-3">
        <Photo name={me.fullName} variant={2} className="h-16 w-16 rounded-full" />
        <div>
          <p className="font-display text-lg font-bold">{me.fullName}</p>
          <p className="text-xs text-muted">
            {me.filiere} · {me.level} · Douala
          </p>
          <Badge tone="ok" className="mt-1">
            Profil vérifié
          </Badge>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Apparence
        </h2>
        <AppearanceControls />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Mes univers
        </h2>
        <Card className="flex flex-col p-0">
          {universes.map((universe) => (
            <Link
              key={universe.href}
              href={universe.href}
              className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-3.5 text-sm font-semibold last:border-0"
            >
              {universe.label}
              <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
            </Link>
          ))}
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xs font-bold uppercase tracking-[.08em] text-muted">
          Données
        </h2>
        <div className="flex flex-col gap-2">
          <Button variant="outline" block>
            Exporter mes données
          </Button>
          <Button variant="danger" block>
            Supprimer mon compte
          </Button>
        </div>
        <p className="text-xs text-muted">
          La suppression efface le profil, les dates et les messages. Les données de paiement sont
          conservées selon la loi.
        </p>
      </section>

      <Button variant="ghost" block>
        Se déconnecter
      </Button>
    </div>
  );
}
