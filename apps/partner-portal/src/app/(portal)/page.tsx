import { Badge, Button, ConsoleNotice, StatPlate } from '@conexa/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { TonightBoard } from '../../features/reservations/tonight-board';
import { TONIGHT_STATS } from '../../shell/fixtures';

export const metadata: Metadata = { title: 'Ce soir' };

export default function TonightPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="min-w-0 flex-1 font-display text-2xl font-extrabold uppercase leading-tight text-ink">
          Chez Mama Têté
        </h1>
        <Badge tone="ok">Partenaire actif</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatPlate label="Réservations ce soir" value={TONIGHT_STATS.reservations} accent />
        <StatPlate label="Couverts cette semaine" value={TONIGHT_STATS.coversThisWeek} />
        <StatPlate label="À recevoir" value={TONIGHT_STATS.payout} unit="XAF" />
      </div>

      <h2 className="font-display text-sm font-bold uppercase tracking-[.06em] text-muted">
        Ce soir
      </h2>
      <TonightBoard />

      <ConsoleNotice>
        Le paiement est versé après validation de l’arrivée, sous 48 h. Le menu duo et son prix se
        modifient depuis l’onglet Menu.
      </ConsoleNotice>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href="/menu">Modifier le menu</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/creneaux">Définir mes créneaux</Link>
        </Button>
      </div>

      <p className="text-xs text-muted">
        Seuls le prénom et le code de réservation sont affichés. Aucun numéro de téléphone ni
        matricule étudiant ne transite par le portail.
      </p>
    </div>
  );
}
