'use client';

import { Badge, Button, Table, cn, type TableColumn } from '@conexa/ui';
import { useState } from 'react';

import { TONIGHT, type Reservation } from '../../shell/fixtures';

/**
 * Réservations du soir (maquette Portal). La validation d'arrivée est locale :
 * le service Partners déclenchera le versement après confirmation serveur.
 * Aucune donnée personnelle au-delà du prénom et du code de réservation.
 */
export function TonightBoard() {
  const [reservations, setReservations] = useState<Reservation[]>(TONIGHT);
  const [announcement, setAnnouncement] = useState('');

  function confirmArrival(reservation: Reservation) {
    setReservations((current) =>
      current.map((item) => (item.id === reservation.id ? { ...item, arrived: true } : item)),
    );
    setAnnouncement(
      `Arrivée de ${reservation.firstName} confirmée pour ${reservation.covers} couverts (${reservation.code}).`,
    );
  }

  const columns: TableColumn[] = [
    { key: 'time', header: 'Heure' },
    { key: 'code', header: 'Code' },
    { key: 'firstName', header: 'Client' },
    { key: 'covers', header: 'Couverts', numeric: true },
    { key: 'action', header: 'Action' },
  ];

  const rows = reservations.map((reservation) => ({
    id: reservation.id,
    time: <span className="font-mono text-sm text-ink">{reservation.time}</span>,
    code: <span className="font-mono text-xs text-muted">{reservation.code}</span>,
    firstName: reservation.firstName,
    covers: reservation.covers,
    action: reservation.arrived ? (
      <Badge tone="ok">Arrivé</Badge>
    ) : (
      <Button size="sm" onClick={() => confirmArrival(reservation)}>
        Valider l’arrivée
      </Button>
    ),
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden sm:block">
        <Table
          caption="Réservations de ce soir"
          columns={columns}
          rows={rows}
          empty="Aucune réservation pour ce service."
        />
      </div>

      {/* Téléphone : une carte par réservation, sans défilement horizontal. */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {reservations.length === 0 ? (
          <li className="text-sm text-muted">Aucune réservation.</li>
        ) : null}
        {reservations.map((reservation) => (
          <li
            key={reservation.id}
            className="flex flex-col gap-2 border border-line bg-surface p-3"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-semibold text-ink">{reservation.time}</span>
              <span className="font-mono text-[11px] text-muted">{reservation.code}</span>
              <span className="ml-auto font-mono text-[11px] text-muted">
                {reservation.covers} couverts
              </span>
            </div>
            <span className="text-sm text-ink">{reservation.firstName}</span>
            {reservation.arrived ? (
              <Badge tone="ok">Arrivé</Badge>
            ) : (
              <Button size="sm" block onClick={() => confirmArrival(reservation)}>
                Valider l’arrivée
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p
        role="status"
        aria-live="polite"
        className={cn('text-xs', announcement ? 'text-ink' : 'sr-only')}
      >
        {announcement}
      </p>
    </div>
  );
}
