'use client';

import { Badge, Button, Card, EmptyState, Skeleton } from '@conexa/ui';

import { TopBar } from '../../shell/maquettes/kit';
import { messages as m } from './messages';
import { useInvoices } from './use-billing';
import { formatDate, formatFcfa, invoiceStatus } from './view';

/** Factures d'abonnement : numéro, remise, total et statut, tels que le serveur les émet. */
export function InvoicesScreen() {
  const invoices = useInvoices();

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title={m.invoicesTitle} back="/billing" />
      {invoices.isLoading ? <Skeleton className="h-20" /> : null}
      {invoices.isError ? (
        <EmptyState
          title={m.loadError}
          action={
            <Button variant="outline" onClick={() => void invoices.refetch()}>
              {m.retry}
            </Button>
          }
        />
      ) : null}
      {invoices.data && invoices.data.length === 0 ? <EmptyState title={m.invoicesEmpty} /> : null}
      <ul className="flex flex-col gap-2">
        {(invoices.data ?? []).map((invoice) => {
          const status = invoiceStatus(invoice.status);
          return (
            <li key={invoice.id}>
              <Card className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm font-bold">{invoice.number}</p>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="text-xs text-muted">
                  {invoice.plan_code} · {formatDate(invoice.issued_at)}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">
                    {invoice.discount_fcfa > 0
                      ? `${formatFcfa(invoice.base_fcfa)} − ${formatFcfa(invoice.discount_fcfa)}`
                      : formatFcfa(invoice.base_fcfa)}
                  </span>
                  <span className="font-mono font-bold">{formatFcfa(invoice.total_fcfa)}</span>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
