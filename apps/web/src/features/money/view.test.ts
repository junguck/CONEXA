import type { Invoice, Plan, Subscription } from '@conexa/contracts';
import { describe, expect, it } from 'vitest';

import {
  formatFcfa,
  invoiceStatus,
  isPlausiblePhone,
  planRows,
  purchasePhase,
  subscriptionView,
  toMsisdn,
} from './view';

const base: Subscription = {
  id: '00000000-0000-4000-8000-000000000001',
  user_id: '00000000-0000-4000-8000-000000000002',
  plan_code: 'student_plus',
  status: 'active',
  payment_id: null,
  started_at: '2026-10-01T00:00:00.000Z',
  current_period_end: '2026-11-01T00:00:00.000Z',
  grace_until: null,
  cancel_at_period_end: false,
  cancelled_at: null,
};

describe('formatFcfa', () => {
  it('groupe les milliers et garde des entiers', () => {
    expect(formatFcfa(0)).toBe('0 FCFA');
    expect(formatFcfa(2500)).toBe('2 500 FCFA');
    expect(formatFcfa(1234567)).toBe('1 234 567 FCFA');
  });
});

describe('subscriptionView', () => {
  it('sans abonnement : plan gratuit, pas de résiliation', () => {
    const view = subscriptionView(null);
    expect(view.label).toBe('Gratuit');
    expect(view.canCancel).toBe(false);
  });

  it('actif : résiliable', () => {
    expect(subscriptionView(base)).toMatchObject({ label: 'Actif', tone: 'ok', canCancel: true });
  });

  it('résiliation programmée : droits jusqu’à la fin de période, plus résiliable', () => {
    const view = subscriptionView({ ...base, cancel_at_period_end: true });
    expect(view.label).toBe('Résiliation programmée');
    expect(view.canCancel).toBe(false);
    expect(view.detail).toContain('novembre');
  });

  it('past_due : mentionne la fin de grâce fournie par le serveur', () => {
    const view = subscriptionView({
      ...base,
      status: 'past_due',
      grace_until: '2026-11-04T00:00:00.000Z',
    });
    expect(view.tone).toBe('bad');
    expect(view.detail).toContain('4 novembre');
  });

  it('expiré et résilié : aucun droit, aucune action', () => {
    expect(subscriptionView({ ...base, status: 'expired' }).canCancel).toBe(false);
    expect(subscriptionView({ ...base, status: 'cancelled' }).canCancel).toBe(false);
  });
});

describe('purchasePhase', () => {
  const pending = { ...base, status: 'pending' as const };

  it('aucun achat sans abonnement pending', () => {
    expect(purchasePhase(null, null)).toBe('idle');
    expect(purchasePhase(base, 'escrow')).toBe('idle');
  });

  it('pending sans paiement : à payer', () => {
    expect(purchasePhase(pending, null)).toBe('needs_payment');
  });

  it('paiement en attente : reprise de l’attente après fermeture de l’app', () => {
    expect(purchasePhase(pending, 'pending')).toBe('awaiting_confirmation');
  });

  it('succès : fonds reçus, activation restante', () => {
    expect(purchasePhase(pending, 'escrow')).toBe('ready_to_activate');
  });

  it('échec ou expiration : réessai possible, aucun droit', () => {
    expect(purchasePhase(pending, 'failed')).toBe('failed');
    expect(purchasePhase(pending, 'refunded')).toBe('failed');
  });
});

describe('planRows', () => {
  const plans = [
    { code: 'student_free', price_fcfa: 0, period: 'monthly' },
    { code: 'student_plus', price_fcfa: 2500, period: 'monthly' },
    { code: 'student_plus_year', price_fcfa: 24000, period: 'yearly' },
  ] as Plan[];

  it('marque le plan courant et le plan gratuit', () => {
    const rows = planRows(plans, 'student_plus');
    expect(rows.map((row) => row.isCurrent)).toEqual([false, true, false]);
    expect(rows[0]).toMatchObject({ isFree: true, priceLabel: 'Gratuit' });
    expect(rows[2]?.periodLabel).toBe('par an');
  });
});

describe('invoiceStatus', () => {
  it('traduit chaque statut', () => {
    const statuses: Invoice['status'][] = ['open', 'paid', 'void'];
    expect(statuses.map((status) => invoiceStatus(status).label)).toEqual([
      'À payer',
      'Payée',
      'Annulée',
    ]);
  });
});

describe('numéro de paiement', () => {
  it('contrôle la longueur sans rien stocker', () => {
    expect(isPlausiblePhone('6 70 00 00')).toBe(false);
    expect(isPlausiblePhone('670 000 000')).toBe(true);
    expect(isPlausiblePhone('abc')).toBe(false);
  });

  it('ajoute le préfixe pays une seule fois', () => {
    expect(toMsisdn('670 000 000')).toBe('237670000000');
    expect(toMsisdn('+237 670 000 000')).toBe('237670000000');
  });
});
