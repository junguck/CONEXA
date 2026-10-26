'use client';

import { Badge, Button, Card } from '@conexa/ui';
import Link from 'next/link';
import { useState } from 'react';

import { payments } from './data';
import { Hint } from './kit';

const TONES = { 'En séquestre': 'accent', Versé: 'ok', Remboursé: 'neutral' } as const;

export function PaymentsList() {
  const [selectedId, setSelectedId] = useState(payments[0]?.id ?? '');
  const [requested, setRequested] = useState(false);
  const selected = payments.find((payment) => payment.id === selectedId) ?? payments[0];

  if (!selected) return <p className="text-sm text-muted">Aucun paiement.</p>;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {payments.map((payment) => (
          <li key={payment.id}>
            <button
              type="button"
              onClick={() => {
                setSelectedId(payment.id);
                setRequested(false);
              }}
              aria-current={payment.id === selected.id ? 'true' : undefined}
              className={`flex w-full items-center gap-3 rounded-token border px-3.5 py-3 text-left ${
                payment.id === selected.id ? 'border-accent bg-surface2' : 'border-line bg-surface'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {payment.label}
                </span>
                <span className="block font-mono text-[10px] text-muted">
                  {payment.reference} · {payment.when}
                </span>
              </span>
              <span className="flex flex-none flex-col items-end gap-1">
                <span className="font-mono text-xs font-bold text-ink">{payment.amount}</span>
                <Badge tone={TONES[payment.state]}>{payment.state}</Badge>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">{selected.label}</span>
          <Badge tone={TONES[selected.state]}>{selected.state}</Badge>
        </div>
        <p className="text-sm text-muted">{selected.detail}</p>
        <p className="font-mono text-xs text-muted">
          Montant : <span className="text-ink">{selected.amount}</span> · Réf. {selected.reference}
        </p>

        {selected.state === 'En séquestre' ? (
          requested ? (
            <p role="status" className="text-xs text-accent-text">
              Demande envoyée. Un remboursement est gratuit jusqu’à 3 h avant le date ; au-delà, le
              restaurant retient sa part.
            </p>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setRequested(true)}>
              Demander l’annulation
            </Button>
          )
        ) : null}
      </Card>

      <Hint>
        Les montants restent en séquestre jusqu’à la fin du date ou la confirmation de la
        prestation. Aucun remboursement ne part d’ici sans validation du serveur.
      </Hint>

      <Button asChild variant="outline" block>
        <Link href="/meet/dates">Voir mes dates</Link>
      </Button>
    </div>
  );
}
