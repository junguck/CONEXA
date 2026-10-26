'use client';

import { Badge, StatPlate, Table, chipClass, type TableColumn } from '@conexa/ui';
import { useState } from 'react';

import { LEDGER, LEDGER_TOTALS } from '../../shell/fixtures';

type Month = keyof typeof LEDGER_TOTALS;

const MONTHS: Array<{ value: Month; label: string }> = [
  { value: 'octobre', label: 'Octobre' },
  { value: 'septembre', label: 'Septembre' },
];

const TONES = {
  Bloqué: 'accent',
  Versé: 'ok',
  Encaissé: 'ok',
  Remboursé: 'neutral',
} as const;

/** Flux financiers (maquette BoFinance) : lecture seule, montants en XAF. */
export function FinanceLedger() {
  const [month, setMonth] = useState<Month>('octobre');
  const totals = LEDGER_TOTALS[month];

  const columns: TableColumn[] = [
    { key: 'reference', header: 'Référence' },
    { key: 'type', header: 'Type' },
    { key: 'amount', header: 'Montant', numeric: true },
    { key: 'state', header: 'État' },
    { key: 'date', header: 'Date' },
  ];

  const rows = LEDGER.filter((entry) => entry.month === month).map((entry) => ({
    id: entry.id,
    reference: <span className="font-mono text-xs">{entry.reference}</span>,
    type: entry.type,
    amount: <span className="font-mono text-sm">{entry.amount}</span>,
    state: <Badge tone={TONES[entry.state]}>{entry.state}</Badge>,
    date: <span className="font-mono text-xs text-muted">{entry.date}</span>,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {MONTHS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={month === item.value}
            onClick={() => setMonth(item.value)}
            className={chipClass}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatPlate label="Encaissé" value={totals.collected} unit="XAF" accent />
        <StatPlate label="Bloqué (séquestre)" value={totals.escrow} unit="XAF" />
        <StatPlate label="Reversé aux restaurants" value={totals.paidOut} unit="XAF" />
        <StatPlate label="Remboursements" value={totals.refunded} unit="XAF" />
      </div>

      <Table
        caption={`Mouvements financiers de ${month}`}
        columns={columns}
        rows={rows}
        empty="Aucun mouvement ce mois-ci."
      />

      <p className="text-xs text-muted">
        Chiffres de la maquette. Les montants réels proviennent du service paiements ; aucun
        remboursement ne se déclenche depuis cet écran.
      </p>
    </div>
  );
}
