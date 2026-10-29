import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  BILLING_EVENTS,
  type Entitlements,
  type Plan,
  type PlanAudience,
  type Subscription,
  type SubscriptionStatus,
} from '@conexa/contracts';
import { AppError, forbidden, notFound, validationError } from '@conexa/errors';
import { createEvent, type EventPublisher } from '@conexa/events';

import {
  assertCanActivate,
  assertPaymentMatchesPlan,
  canSubscribe,
  dueTransition,
  fallbackAudience,
  graceUntil,
  hasRights,
  invoiceTotals,
  isActive,
  periodEnd,
  promoAcceptable,
} from './billing.rules.js';
import { env } from './config.js';
import { db, entitlementsOf, type PlanRow } from './db.js';
import { BILLING_CLOCK, BILLING_EVENT_BUS } from './events.js';
import { createSubscriptionPayments, type SubscriptionPayments } from './payments.client.js';

const SWEEP_BATCH = 50;

/**
 * Ligne d'abonnement lue par le service : les colonnes d'audit
 * (`created_at`, `updated_at`) ne participent à aucune décision.
 */
interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_code: string;
  status: SubscriptionStatus;
  payment_id: string | null;
  started_at: Date | null;
  current_period_end: Date | null;
  grace_until: Date | null;
  cancel_at_period_end: boolean;
  cancelled_at: Date | null;
}

const SUBSCRIPTION_COLUMNS = [
  'id',
  'user_id',
  'plan_code',
  'status',
  'payment_id',
  'started_at',
  'current_period_end',
  'grace_until',
  'cancel_at_period_end',
  'cancelled_at',
] as const;

@Injectable()
export class BillingService {
  private readonly payments: SubscriptionPayments = createSubscriptionPayments();

  constructor(
    @Inject(BILLING_CLOCK) private readonly now: () => Date,
    @Inject(BILLING_EVENT_BUS) private readonly events: EventPublisher,
  ) {}

  async listPlans(): Promise<Plan[]> {
    const rows = await db
      .selectFrom('plans')
      .selectAll()
      .orderBy('audience')
      .orderBy('price_fcfa')
      .execute();
    return rows.map((row) => this.toPlan(row));
  }

  /** Abonnement courant et droits effectifs : ce que l'écran affiche. */
  async me(userId: string, role: string) {
    const subscription = await this.currentSubscription(userId);
    const plan = await this.planForUser(subscription, role);
    return {
      subscription: subscription ? this.toSubscription(subscription) : null,
      entitlements: entitlementsOf(plan),
    };
  }

  /** Souscription : immédiate pour un plan gratuit, facture ouverte sinon. */
  async subscribe(
    userId: string,
    planCode: string,
    role: string,
    promoCode?: string,
  ): Promise<Subscription> {
    const plan = await this.loadPlan(planCode);
    if (!canSubscribe(role, plan.audience)) {
      throw forbidden('Plan réservé à une autre audience');
    }

    const current = await this.currentSubscription(userId);
    if (current && current.plan_code === planCode && isActive(current, this.now())) {
      return this.toSubscription(current);
    }

    const id = randomUUID();
    const free = plan.price_fcfa === 0;
    if (free && promoCode) {
      throw new AppError('VALIDATION_ERROR', 'Plan gratuit : aucun code promo attendu');
    }

    if (free) {
      const row = await this.replaceWithFree(userId, planCode, id);
      await this.publishEntitlements(userId, plan.audience, plan.code, 'plan_changed');
      return this.toSubscription(row);
    }

    // Facture d'abonnement : écrite dans la même transaction que l'abonnement.
    // Un code promo vaut si la fenêtre et le plafond le permettent au moment
    // de la souscription ; la remise est un plancher FCFA entier, jamais
    // négative.
    let discountPct = 0;
    let appliedCode: string | null = null;
    if (promoCode) {
      const promo = await db
        .selectFrom('promo_codes')
        .selectAll()
        .where('code', '=', promoCode)
        .executeTakeFirst();
      if (promo === undefined) {
        throw validationError(`Code promo inconnu : ${promoCode}`);
      }
      promoAcceptable(promo, this.now(), promoCode, promo.code);
      discountPct = promo.discount_pct;
      appliedCode = promo.code;
    }

    const totals = invoiceTotals(plan.price_fcfa, discountPct);

    const { subscription, invoice } = await db.transaction().execute(async (trx) => {
      const invoice = await trx
        .insertInto('invoices')
        .values({
          id: randomUUID(),
          subscription_id: id,
          user_id: userId,
          plan_code: plan.code,
          base_fcfa: totals.base_fcfa,
          discount_fcfa: totals.discount_fcfa,
          total_fcfa: totals.total_fcfa,
          promo_code: appliedCode,
          status: 'open' as const,
          issued_at: this.now(),
        })
        .returning([
          'id',
          'subscription_id',
          'user_id',
          'number',
          'plan_code',
          'base_fcfa',
          'discount_fcfa',
          'total_fcfa',
          'promo_code',
          'status',
          'payment_id',
          'issued_at',
          'paid_at',
        ])
        .executeTakeFirstOrThrow();

      if (appliedCode) {
        const redeemed = await trx
          .updateTable('promo_codes')
          .set((eb) => ({ redeemed_count: eb('redeemed_count', '+', 1) }))
          .where('code', '=', appliedCode)
          .returning(['redeemed_count'])
          .executeTakeFirstOrThrow();
        const promo = await trx
          .selectFrom('promo_codes')
          .select(['max_redemptions'])
          .where('code', '=', appliedCode)
          .executeTakeFirstOrThrow();
        if (promo.max_redemptions !== null && redeemed.redeemed_count > promo.max_redemptions) {
          throw new AppError('VALIDATION_ERROR', `Code promo épuisé : ${appliedCode}`);
        }
      }

      // Un plan payant attend son paiement, l'ancien reste actif jusque-là.
      const subscription = await trx
        .insertInto('subscriptions')
        .values({
          id,
          user_id: userId,
          plan_code: planCode,
          status: 'pending' as const,
          cancel_at_period_end: false,
        })
        .returning([...SUBSCRIPTION_COLUMNS])
        .executeTakeFirstOrThrow();
      return { subscription, invoice };
    });

    await this.publish(BILLING_EVENTS.invoiceIssued, {
      invoice_id: invoice.id,
      subscription_id: invoice.subscription_id,
      user_id: invoice.user_id,
      number: invoice.number,
      base_fcfa: invoice.base_fcfa,
      discount_fcfa: invoice.discount_fcfa,
      total_fcfa: invoice.total_fcfa,
    });
    return this.toSubscription(subscription);
  }

  /** Active un plan payant après vérification du séquestre côté Payments. */
  async activate(userId: string, subscriptionId: string, paymentId: string): Promise<Subscription> {
    const subscription = await this.loadSubscription(subscriptionId);
    if (subscription.user_id !== userId) {
      throw forbidden('Abonnement d’un autre compte');
    }
    assertCanActivate(subscription.status);

    const plan = await this.loadPlan(subscription.plan_code);
    assertPaymentMatchesPlan(plan.price_fcfa, paymentId !== undefined);

    const invoice = await this.openInvoiceFor(subscription.id);
    // Montant attendu : total de la facture (promo déduite), sinon prix du plan.
    const expected = invoice ? invoice.total_fcfa : plan.price_fcfa;
    assertPaymentMatchesPlan(expected, paymentId !== undefined);

    const payment = await this.payments.getPayment(paymentId);
    if (payment.object_type !== 'subscription' || payment.object_id !== subscription.id) {
      throw new AppError('VALIDATION_ERROR', 'Paiement d’un autre objet');
    }
    if (payment.amount_fcfa !== expected) {
      throw new AppError('VALIDATION_ERROR', 'Montant différent de la facture', {
        expected_fcfa: expected,
        received_fcfa: payment.amount_fcfa,
      });
    }
    if (payment.status !== 'escrow') {
      throw new AppError('INVALID_STATE', 'Paiement non encaissé : activation impossible');
    }

    const days = plan.period === 'yearly' ? env.BILLING_PERIOD_DAYS * 12 : env.BILLING_PERIOD_DAYS;

    const updated = await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('subscriptions')
        .set({ status: 'cancelled', cancelled_at: this.now(), updated_at: this.now() })
        .where('user_id', '=', userId)
        .where('status', '=', 'active')
        .execute();

      if (invoice) {
        await trx
          .updateTable('invoices')
          .set({ status: 'paid' as const, payment_id: paymentId, paid_at: this.now() })
          .where('id', '=', invoice.id)
          .where('status', '=', 'open')
          .execute();
      }

      return trx
        .updateTable('subscriptions')
        .set({
          status: 'active',
          payment_id: paymentId,
          started_at: this.now(),
          current_period_end: periodEnd(this.now(), days),
          grace_until: null,
          updated_at: this.now(),
        })
        .where('id', '=', subscription.id)
        .returning([...SUBSCRIPTION_COLUMNS])
        .executeTakeFirstOrThrow();
    });

    await this.publish(BILLING_EVENTS.subscriptionActivated, {
      subscription_id: updated.id,
      user_id: updated.user_id,
      plan_code: updated.plan_code,
      current_period_end: updated.current_period_end?.toISOString() ?? new Date().toISOString(),
    });
    await this.publishEntitlements(userId, plan.audience, plan.code, 'activated');
    return this.toSubscription(updated);
  }

  /**
   * Résiliation. Sans option, immédiate ; avec `at_period_end`, l'abonnement
   * tourne jusqu'à la fin de la période, le balayage quotidien le cloturera.
   */
  async cancel(
    userId: string,
    subscriptionId: string,
    options?: { at_period_end?: boolean },
  ): Promise<Subscription> {
    const subscription = await this.loadSubscription(subscriptionId);
    if (subscription.user_id !== userId) {
      throw forbidden('Abonnement d’un autre compte');
    }
    if (subscription.status === 'cancelled' || subscription.status === 'expired') {
      return this.toSubscription(subscription);
    }
    if (subscription.status !== 'active' && subscription.status !== 'pending') {
      throw new AppError('INVALID_STATE', 'Abonnement non résiliable dans cet état');
    }

    const atPeriodEnd = options?.at_period_end === true;
    if (atPeriodEnd && subscription.status === 'active') {
      const updated = await db
        .updateTable('subscriptions')
        .set({ cancel_at_period_end: true, updated_at: this.now() })
        .where('id', '=', subscription.id)
        .returning([...SUBSCRIPTION_COLUMNS])
        .executeTakeFirstOrThrow();
      return this.toSubscription(updated);
    }

    const updated = await db
      .updateTable('subscriptions')
      .set({ status: 'cancelled', cancelled_at: this.now(), updated_at: this.now() })
      .where('id', '=', subscription.id)
      .returning([...SUBSCRIPTION_COLUMNS])
      .executeTakeFirstOrThrow();

    // Une souscription payante non payée : la facture reste ouverte mais
    // sans paiement attendu ; une facture payée n'est pas remboursée ici.
    const plan = await this.loadPlan(updated.plan_code);
    await this.publishEntitlements(userId, plan.audience, plan.code, 'cancelled');
    return this.toSubscription(updated);
  }

  /** Factures de l'utilisateur, les plus récentes d'abord. */
  async listInvoices(userId: string) {
    const rows = await db
      .selectFrom('invoices')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('issued_at', 'desc')
      .limit(50)
      .execute();
    return rows.map((row) => this.toInvoice(row));
  }

  /**
   * Balayage quotidien (T-0026) : `active` échu → `past_due` avec 3 jours de
   * grâce ; `past_due` échu → `expired` (droits au plan gratuit) ;
   * `active` en résiliation différée échue → `cancelled`. Chaque transition
   * publie son événement ; le balayage est idempotent et borné.
   */
  async runDailySweep(): Promise<{ examined: number; changed: number }> {
    const now = this.now();
    const rows = await db
      .selectFrom('subscriptions')
      .select([...SUBSCRIPTION_COLUMNS])
      .where('status', 'in', ['active', 'past_due'])
      .orderBy('current_period_end', 'asc')
      .limit(SWEEP_BATCH)
      .execute();
    if (rows.length === 0) {
      return { examined: 0, changed: 0 };
    }

    let changed = 0;
    for (const row of rows) {
      const transition = dueTransition(
        row.status,
        row.current_period_end,
        row.grace_until,
        row.cancel_at_period_end,
        now,
      );
      if (transition === null) {
        continue;
      }

      const plan = await this.loadPlan(row.plan_code);
      const patch: Record<string, unknown> = { updated_at: now };
      if (transition === 'past_due') {
        patch.status = 'past_due' as const;
        patch.grace_until = graceUntil(now);
      } else {
        patch.status = transition;
      }
      if (transition === 'cancelled') {
        patch.cancelled_at = now;
      }

      const updated = await db
        .updateTable('subscriptions')
        .set(patch)
        .where('id', '=', row.id)
        .where('status', '=', row.status)
        .returning([...SUBSCRIPTION_COLUMNS])
        .executeTakeFirst();
      if (!updated) {
        continue; // Déjà traité par une autre exécution : idempotent.
      }
      changed += 1;

      if (transition === 'past_due') {
        await this.publish(BILLING_EVENTS.subscriptionPastDue, {
          subscription_id: updated.id,
          user_id: updated.user_id,
          plan_code: updated.plan_code,
          grace_until: (updated.grace_until ?? graceUntil(now)).toISOString(),
        });
        continue;
      }

      if (transition === 'expired') {
        await this.publish(BILLING_EVENTS.subscriptionExpired, {
          subscription_id: updated.id,
          user_id: updated.user_id,
          plan_code: updated.plan_code,
          reason: 'payment_failed' as const,
        });
        await this.publishEntitlements(updated.user_id, plan.audience, plan.code, 'expired');
        continue;
      }

      // cancelled : la résiliation différée arrive à terme.
      await this.publish(BILLING_EVENTS.subscriptionCancelled, {
        subscription_id: updated.id,
        user_id: updated.user_id,
        plan_code: updated.plan_code,
        cancelled_at: now.toISOString(),
      });
      await this.publishEntitlements(updated.user_id, plan.audience, plan.code, 'cancelled');
    }

    return { examined: rows.length, changed };
  }

  /** Lecture service à service : Marketplace et Talents appliquent ces droits. */
  async entitlementsFor(userId: string, audience?: PlanAudience): Promise<Entitlements> {
    const subscription = await this.currentSubscription(userId);
    const plan = subscription
      ? await this.loadPlan(subscription.plan_code)
      : await this.defaultPlan(audience ?? 'student');
    return entitlementsOf(plan);
  }

  private async currentSubscription(userId: string): Promise<SubscriptionRow | undefined> {
    // Avec la grâce, `past_due` garde ses droits : les deux statuts comptent.
    const candidates = await db
      .selectFrom('subscriptions')
      .select([...SUBSCRIPTION_COLUMNS])
      .where('user_id', '=', userId)
      .where('status', 'in', ['active', 'past_due'])
      .orderBy('created_at', 'desc')
      .execute();

    return candidates.find((row) => hasRights(row, this.now()));
  }

  private async openInvoiceFor(subscriptionId: string) {
    return db
      .selectFrom('invoices')
      .selectAll()
      .where('subscription_id', '=', subscriptionId)
      .where('status', '=', 'open')
      .executeTakeFirst();
  }

  private async planForUser(subscription: SubscriptionRow | undefined, role: string) {
    if (subscription) {
      return this.loadPlan(subscription.plan_code);
    }
    return this.defaultPlan(fallbackAudience(role));
  }

  private async defaultPlan(audience: PlanAudience): Promise<PlanRow> {
    const row = await db
      .selectFrom('plans')
      .selectAll()
      .where('audience', '=', audience)
      .where('is_default', '=', true)
      .executeTakeFirst();

    if (!row) {
      throw notFound(`Plan gratuit de l’audience ${audience}`);
    }
    return row;
  }

  private async loadPlan(code: string): Promise<PlanRow> {
    const plan = await db
      .selectFrom('plans')
      .selectAll()
      .where('code', '=', code)
      .executeTakeFirst();
    if (!plan) {
      throw notFound('Plan');
    }
    return plan;
  }

  private async loadSubscription(id: string): Promise<SubscriptionRow> {
    const row = await db
      .selectFrom('subscriptions')
      .select([...SUBSCRIPTION_COLUMNS])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Abonnement');
    }
    return row;
  }

  /**
   * Un plan gratuit remplace immédiatement l'abonnement actif précédent.
   * Les factures ouvertes d'un ancien plan restent consultables mais le
   * paiement n'y est plus attendu.
   */
  private async replaceWithFree(
    userId: string,
    planCode: string,
    id: string,
  ): Promise<SubscriptionRow> {
    return db.transaction().execute(async (trx) => {
      await trx
        .updateTable('subscriptions')
        .set({ status: 'cancelled', cancelled_at: this.now(), updated_at: this.now() })
        .where('user_id', '=', userId)
        .where('status', '=', 'active')
        .execute();

      return trx
        .insertInto('subscriptions')
        .values({
          id,
          user_id: userId,
          plan_code: planCode,
          status: 'active',
          started_at: this.now(),
          current_period_end: null,
          cancel_at_period_end: false,
        })
        .returning([...SUBSCRIPTION_COLUMNS])
        .executeTakeFirstOrThrow();
    });
  }

  /**
   * `entitlements.changed` : les consommateurs purgent leur cache de 60 s et
   * relisent. Aucun droit en clair dans l'événement.
   */
  private async publishEntitlements(
    userId: string,
    audience: PlanAudience,
    planCode: string,
    reason: 'activated' | 'cancelled' | 'expired' | 'plan_changed' | 'grant',
  ): Promise<void> {
    await this.publish(BILLING_EVENTS.entitlementsChanged, {
      subject_kind: 'user',
      subject_id: userId,
      audience,
      plan_code: planCode,
      reason,
      changed_at: this.now().toISOString(),
    });
  }

  private async publish(type: string, payload: Record<string, unknown>): Promise<void> {
    // Le port de publication est strictement par lot : un événement = un lot d'un.
    await this.events.publish([createEvent({ type, producer: 'billing', payload })]);
  }

  private toPlan(row: PlanRow): Plan {
    return {
      code: row.code,
      name: row.name,
      audience: row.audience,
      price_fcfa: row.price_fcfa,
      period: row.period,
      entitlements: entitlementsOf(row),
      is_default: row.is_default,
    };
  }

  private toSubscription(row: SubscriptionRow): Subscription {
    return {
      id: row.id,
      user_id: row.user_id,
      plan_code: row.plan_code,
      status: row.status,
      payment_id: row.payment_id,
      started_at: row.started_at?.toISOString() ?? null,
      current_period_end: row.current_period_end?.toISOString() ?? null,
      grace_until: row.grace_until?.toISOString() ?? null,
      cancel_at_period_end: row.cancel_at_period_end,
      cancelled_at: row.cancelled_at?.toISOString() ?? null,
    };
  }

  private toInvoice(row: {
    id: string;
    subscription_id: string;
    user_id: string;
    number: string;
    plan_code: string;
    base_fcfa: number;
    discount_fcfa: number;
    total_fcfa: number;
    promo_code: string | null;
    status: 'open' | 'paid' | 'void';
    payment_id: string | null;
    issued_at: Date;
    paid_at: Date | null;
  }) {
    return {
      id: row.id,
      subscription_id: row.subscription_id,
      user_id: row.user_id,
      number: row.number,
      plan_code: row.plan_code,
      base_fcfa: row.base_fcfa,
      discount_fcfa: row.discount_fcfa,
      total_fcfa: row.total_fcfa,
      promo_code: row.promo_code,
      status: row.status,
      payment_id: row.payment_id,
      issued_at: row.issued_at.toISOString(),
      paid_at: row.paid_at?.toISOString() ?? null,
    };
  }
}
