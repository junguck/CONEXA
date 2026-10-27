import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  Entitlements,
  Plan,
  PlanAudience,
  Subscription,
  SubscriptionStatus,
} from '@conexa/contracts';
import { AppError, forbidden, notFound } from '@conexa/errors';

import {
  assertCanActivate,
  assertPaymentMatchesPlan,
  canSubscribe,
  fallbackAudience,
  isActive,
  periodEnd,
} from './billing.rules.js';
import { env } from './config.js';
import { db, entitlementsOf, type PlanRow } from './db.js';
import { createSubscriptionPayments, type SubscriptionPayments } from './payments.client.js';

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_code: string;
  status: SubscriptionStatus;
  payment_id: string | null;
  started_at: Date | null;
  current_period_end: Date | null;
  cancelled_at: Date | null;
}

@Injectable()
export class BillingService {
  private readonly payments: SubscriptionPayments = createSubscriptionPayments();
  private readonly now = () => new Date();

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

  /** Souscription : immédiate pour un plan gratuit, en attente sinon. */
  async subscribe(userId: string, planCode: string, role: string): Promise<Subscription> {
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

    const row = await db.transaction().execute(async (trx) => {
      // Un seul abonnement actif par compte : un plan gratuit remplace
      // immédiatement l'ancien. Un plan payant attend son paiement, l'ancien
      // reste actif jusque-là.
      if (free) {
        await trx
          .updateTable('subscriptions')
          .set({ status: 'cancelled', cancelled_at: this.now(), updated_at: this.now() })
          .where('user_id', '=', userId)
          .where('status', '=', 'active')
          .execute();
      }

      return trx
        .insertInto('subscriptions')
        .values({
          id,
          user_id: userId,
          plan_code: planCode,
          status: free ? 'active' : 'pending',
          started_at: free ? this.now() : null,
          current_period_end: null,
        })
        .returning([
          'id',
          'user_id',
          'plan_code',
          'status',
          'payment_id',
          'started_at',
          'current_period_end',
          'cancelled_at',
        ])
        .executeTakeFirstOrThrow();
    });

    return this.toSubscription(row);
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

    const payment = await this.payments.getPayment(paymentId);
    if (payment.object_type !== 'subscription' || payment.object_id !== subscription.id) {
      throw new AppError('VALIDATION_ERROR', 'Paiement d’un autre objet');
    }
    if (payment.amount_fcfa !== plan.price_fcfa) {
      throw new AppError('VALIDATION_ERROR', 'Montant différent du prix du plan', {
        expected_fcfa: plan.price_fcfa,
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

      return trx
        .updateTable('subscriptions')
        .set({
          status: 'active',
          payment_id: paymentId,
          started_at: this.now(),
          current_period_end: periodEnd(this.now(), days),
          updated_at: this.now(),
        })
        .where('id', '=', subscription.id)
        .returning([
          'id',
          'user_id',
          'plan_code',
          'status',
          'payment_id',
          'started_at',
          'current_period_end',
          'cancelled_at',
        ])
        .executeTakeFirstOrThrow();
    });

    return this.toSubscription(updated);
  }

  async cancel(userId: string, subscriptionId: string): Promise<Subscription> {
    const subscription = await this.loadSubscription(subscriptionId);
    if (subscription.user_id !== userId) {
      throw forbidden('Abonnement d’un autre compte');
    }
    if (subscription.status === 'cancelled') {
      return this.toSubscription(subscription);
    }
    if (subscription.status !== 'active' && subscription.status !== 'pending') {
      throw new AppError('INVALID_STATE', 'Abonnement non résiliable dans cet état');
    }

    const updated = await db
      .updateTable('subscriptions')
      .set({ status: 'cancelled', cancelled_at: this.now(), updated_at: this.now() })
      .where('id', '=', subscription.id)
      .returning([
        'id',
        'user_id',
        'plan_code',
        'status',
        'payment_id',
        'started_at',
        'current_period_end',
        'cancelled_at',
      ])
      .executeTakeFirstOrThrow();

    return this.toSubscription(updated);
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
    const row = await db
      .selectFrom('subscriptions')
      .select([
        'id',
        'user_id',
        'plan_code',
        'status',
        'payment_id',
        'started_at',
        'current_period_end',
        'cancelled_at',
      ])
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .orderBy('created_at', 'desc')
      .executeTakeFirst();

    return row && isActive(row, this.now()) ? row : undefined;
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
      .select([
        'id',
        'user_id',
        'plan_code',
        'status',
        'payment_id',
        'started_at',
        'current_period_end',
        'cancelled_at',
      ])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Abonnement');
    }
    return row;
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
      cancelled_at: row.cancelled_at?.toISOString() ?? null,
    };
  }
}
