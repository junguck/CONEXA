'use client';

import type { Invoice, Plan } from '@conexa/contracts';
import { Badge, Button, Card, EmptyState, Input, Skeleton, useToast } from '@conexa/ui';
import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../../shell/api/client';
import { TopBar } from '../../shell/maquettes/kit';
import { moneyApi } from './api';
import { messages as m } from './messages';
import { useInvoices, usePlans, usePurchase } from './use-billing';
import { formatFcfa, isPlausiblePhone, planRows, subscriptionView, toMsisdn } from './view';

type Provider = 'mtn_momo' | 'orange_money';

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : m.genericError;
}

/** Plans, achat et suivi du paiement. Le serveur décide de tout. */
export function PlansScreen() {
  const toast = useToast();
  const plans = usePlans();
  const invoices = useInvoices();
  const purchase = usePurchase();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const current = purchase.subscription;
  const view = subscriptionView(current);
  const currentCode = current && current.status !== 'pending' ? current.plan_code : null;
  const openInvoice = findOpenInvoice(invoices.data, current?.id ?? null);

  const activating = useRef(false);
  useEffect(() => {
    if (purchase.phase !== 'ready_to_activate' || !current || !purchase.payment) return;
    if (activating.current) return;
    activating.current = true;
    moneyApi
      .activate(current.id, purchase.payment.id)
      .then(() => {
        toast.notify({ title: m.activated, tone: 'success' });
        return purchase.refresh();
      })
      .catch((cause: unknown) => setError(errorText(cause)))
      .finally(() => {
        activating.current = false;
      });
  }, [purchase.phase, current, purchase.payment, purchase, toast]);

  async function choose(plan: Plan) {
    setBusy(true);
    setError('');
    try {
      await moneyApi.subscribe({ plan_code: plan.code }, crypto.randomUUID());
      await purchase.refresh();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!current) return;
    setBusy(true);
    setError('');
    try {
      await moneyApi.cancel(current.id);
      await purchase.refresh();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  if (plans.isLoading || purchase.isLoading) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <TopBar title={m.title} back="/" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (plans.isError || purchase.overview.isError) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <TopBar title={m.title} back="/" />
        <EmptyState
          title={m.loadError}
          action={
            <Button
              variant="outline"
              onClick={() => {
                void plans.refetch();
                void purchase.overview.refetch();
              }}
            >
              {m.retry}
            </Button>
          }
        />
      </div>
    );
  }

  const rows = planRows(plans.data ?? [], currentCode);

  return (
    <div className="flex flex-col gap-3 pb-4">
      <TopBar title={m.title} back="/" right={<Badge tone={view.tone}>{view.label}</Badge>} />

      <Card className="flex flex-col gap-1.5">
        <p className="text-sm text-muted">{m.currentPlan}</p>
        <p className="font-display text-lg font-bold">{currentCode ?? m.freePlan}</p>
        <p className="text-sm text-muted">{view.detail}</p>
        {view.canCancel ? (
          <Button variant="outline" disabled={busy} onClick={() => void cancel()}>
            {m.cancel}
          </Button>
        ) : null}
        <a className="text-sm text-accent-text underline" href="/billing/invoices">
          {m.seeInvoices}
        </a>
      </Card>

      {purchase.phase !== 'idle' && current ? (
        <PurchasePanel
          phase={purchase.phase}
          subscriptionId={current.id}
          attempts={purchase.attempts}
          invoice={openInvoice}
          onPaid={purchase.refresh}
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2" aria-label={m.plansLabel}>
        {rows.map(({ plan, isCurrent, isFree, priceLabel, periodLabel }) => (
          <li key={plan.code}>
            <Card className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display font-bold">{plan.name}</p>
                {isCurrent ? <Badge tone="ok">{m.currentBadge}</Badge> : null}
              </div>
              <p className="font-mono text-lg">
                {priceLabel}
                {isFree ? null : <span className="text-xs text-muted"> {periodLabel}</span>}
              </p>
              <p className="text-xs text-muted">
                {m.commission}: {plan.entitlements.commission_pct} % · {m.listings}:{' '}
                {plan.entitlements.max_active_listings}
              </p>
              {isCurrent || purchase.phase !== 'idle' ? null : (
                <Button
                  variant={isFree ? 'outline' : 'primary'}
                  disabled={busy}
                  onClick={() => void choose(plan)}
                >
                  {isFree ? m.chooseFree : m.choose}
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{m.noAdvantage}</p>
    </div>
  );
}

function findOpenInvoice(list: Invoice[] | undefined, subscriptionId: string | null) {
  if (!list || !subscriptionId) return undefined;
  return list.find((item) => item.subscription_id === subscriptionId && item.status === 'open');
}

interface PanelProps {
  phase: 'needs_payment' | 'awaiting_confirmation' | 'ready_to_activate' | 'failed' | 'idle';
  subscriptionId: string;
  attempts: number;
  invoice: Invoice | undefined;
  onPaid: () => Promise<void>;
}

function PurchasePanel({ phase, subscriptionId, attempts, invoice, onPaid }: PanelProps) {
  const [provider, setProvider] = useState<Provider>('mtn_momo');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (phase === 'awaiting_confirmation' || phase === 'ready_to_activate') {
    return (
      <Card className="flex flex-col gap-2" role="status">
        <p className="font-display font-bold">
          {phase === 'ready_to_activate' ? m.activating : m.awaitingTitle}
        </p>
        {phase === 'awaiting_confirmation' ? (
          <>
            <p className="text-sm text-muted">{m.awaitingBody}</p>
            <Button variant="outline" onClick={() => void onPaid()}>
              {m.refresh}
            </Button>
          </>
        ) : null}
      </Card>
    );
  }

  async function pay() {
    if (!invoice) return;
    if (!isPlausiblePhone(phone)) {
      setError(m.phoneInvalid);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await moneyApi.pay(
        {
          object_type: 'subscription',
          object_id: subscriptionId,
          amount_fcfa: invoice.total_fcfa,
          provider,
          phone_msisdn: toMsisdn(phone),
        },
        `sub-pay-${subscriptionId}-${attempts}`,
      );
      await onPaid();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="font-display font-bold">{phase === 'failed' ? m.failedTitle : m.payTitle}</p>
      {phase === 'failed' ? <p className="text-sm text-bad">{m.failedBody}</p> : null}
      {invoice ? (
        <div className="flex items-center justify-between text-sm">
          <span>
            {invoice.number}
            {invoice.discount_fcfa > 0
              ? ` · ${m.discount} ${formatFcfa(invoice.discount_fcfa)}`
              : ''}
          </span>
          <span className="font-mono font-bold">{formatFcfa(invoice.total_fcfa)}</span>
        </div>
      ) : (
        <p className="text-sm text-muted">{m.noInvoice}</p>
      )}
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={m.operator}>
        {(
          [
            { id: 'mtn_momo', label: 'MTN MoMo' },
            { id: 'orange_money', label: 'Orange Money' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={provider === item.id}
            onClick={() => setProvider(item.id)}
            className={`min-h-12 rounded-token border-[1.5px] text-sm font-bold ${
              provider === item.id ? 'border-accent bg-surface2 text-ink' : 'border-line text-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <Input
        label={m.phoneLabel}
        inputMode="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="6…"
        hint={m.phoneHint}
      />
      {error ? (
        <p role="alert" className="text-xs text-bad">
          {error}
        </p>
      ) : null}
      <Button block disabled={busy || !invoice} onClick={() => void pay()}>
        {phase === 'failed' ? m.retryPay : m.confirmPay}
      </Button>
    </Card>
  );
}
