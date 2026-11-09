import type { Invoice, PaymentStatus, Plan, Subscription } from '@conexa/contracts';

/**
 * Logique de présentation des écrans d'argent. Aucune règle métier : prix,
 * remises, grâce et expiration sont décidés par le serveur ; ici on ne fait que
 * traduire ce qu'il renvoie en libellés et en phase d'écran.
 */

export type Tone = 'neutral' | 'accent' | 'ok' | 'bad';

/** `2500` → « 2 500 FCFA » (espace insécable fine, montant entier). */
export function formatFcfa(amount: number): string {
  const digits = Math.trunc(Math.abs(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${amount < 0 ? '-' : ''}${grouped} FCFA`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export interface SubscriptionView {
  label: string;
  tone: Tone;
  detail: string;
  /** Résiliation demandée : on peut encore l'annuler côté serveur, pas ici. */
  canCancel: boolean;
}

/** Statut d'abonnement lisible. La grâce et la fin de période viennent du serveur. */
export function subscriptionView(sub: Subscription | null): SubscriptionView {
  if (!sub) {
    return {
      label: 'Gratuit',
      tone: 'neutral',
      detail: 'Le plan gratuit reste disponible, sans paiement.',
      canCancel: false,
    };
  }
  switch (sub.status) {
    case 'pending':
      return {
        label: 'Paiement en attente',
        tone: 'accent',
        detail: 'Le plan s’active dès que ton paiement est confirmé.',
        canCancel: false,
      };
    case 'active':
      if (sub.cancel_at_period_end) {
        return {
          label: 'Résiliation programmée',
          tone: 'neutral',
          detail: `Tes droits restent ouverts jusqu’au ${formatDate(sub.current_period_end)}.`,
          canCancel: false,
        };
      }
      return {
        label: 'Actif',
        tone: 'ok',
        detail: sub.current_period_end
          ? `Période payée jusqu’au ${formatDate(sub.current_period_end)}.`
          : 'Abonnement actif.',
        canCancel: true,
      };
    case 'past_due':
      return {
        label: 'Renouvellement manqué',
        tone: 'bad',
        detail: sub.grace_until
          ? `Tes droits sont conservés jusqu’au ${formatDate(sub.grace_until)}. Renouvelle pour les garder.`
          : 'Renouvelle pour garder tes droits.',
        canCancel: true,
      };
    case 'expired':
      return {
        label: 'Expiré',
        tone: 'neutral',
        detail: 'Rien n’est supprimé : ce qui dépasse la limite gratuite est mis en pause.',
        canCancel: false,
      };
    case 'cancelled':
      return {
        label: 'Résilié',
        tone: 'neutral',
        detail: 'Le compte est repassé au plan gratuit.',
        canCancel: false,
      };
  }
}

export type PurchasePhase =
  /** Aucun achat en cours. */
  | 'idle'
  /** Abonnement créé, aucun paiement lancé : l'étudiant doit payer. */
  | 'needs_payment'
  /** Paiement lancé, confirmation attendue sur le téléphone. */
  | 'awaiting_confirmation'
  /** Fonds reçus : il reste à activer l'abonnement. */
  | 'ready_to_activate'
  /** Le paiement a échoué ou a expiré : on peut réessayer. */
  | 'failed';

/**
 * Phase d'écran d'un achat, déduite de l'état serveur : l'abonnement `pending`
 * et le statut de son dernier paiement. Rechargée à chaque ouverture, elle
 * permet de reprendre une attente si l'étudiant a fermé l'application.
 */
export function purchasePhase(
  subscription: Subscription | null,
  paymentStatus: PaymentStatus | null,
): PurchasePhase {
  if (!subscription || subscription.status !== 'pending') return 'idle';
  if (paymentStatus === null) return 'needs_payment';
  switch (paymentStatus) {
    case 'pending':
      return 'awaiting_confirmation';
    case 'escrow':
    case 'released':
      return 'ready_to_activate';
    case 'failed':
    case 'refund_pending':
    case 'refunded':
      return 'failed';
  }
}

export interface PlanRow {
  plan: Plan;
  isCurrent: boolean;
  isFree: boolean;
  priceLabel: string;
  periodLabel: string;
}

export function planRows(plans: Plan[], currentCode: string | null): PlanRow[] {
  return plans.map((plan) => ({
    plan,
    isCurrent: plan.code === currentCode,
    isFree: plan.price_fcfa === 0,
    priceLabel: plan.price_fcfa === 0 ? 'Gratuit' : formatFcfa(plan.price_fcfa),
    periodLabel: plan.period === 'yearly' ? 'par an' : 'par mois',
  }));
}

const INVOICE_STATUS: Record<Invoice['status'], { label: string; tone: Tone }> = {
  open: { label: 'À payer', tone: 'accent' },
  paid: { label: 'Payée', tone: 'ok' },
  void: { label: 'Annulée', tone: 'neutral' },
};

export function invoiceStatus(status: Invoice['status']): { label: string; tone: Tone } {
  return INVOICE_STATUS[status];
}

/** Numéro mobile money : seul contrôle local (le serveur reste juge). */
export function isPlausiblePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 12;
}

/** Au moins 9 chiffres ; préfixe pays ajouté si absent (Cameroun). */
export function toMsisdn(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('237') ? digits : `237${digits}`;
}
