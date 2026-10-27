import { Inject, Injectable } from '@nestjs/common';
import type { ServiceOrder } from '@conexa/contracts';
import { AppError, forbidden, notFound } from '@conexa/errors';
import type { Kysely, Selectable } from 'kysely';

import { db } from './db.js';
import type { MarketplaceDb, ServiceOrdersTable } from './db.js';
import {
  ENTITLEMENTS_GATEWAY,
  MARKETPLACE_CLOCK,
  PAYMENTS_GATEWAY,
  type EntitlementsGateway,
  type PaymentsGateway,
} from './gateways.js';
import {
  assertOrderTransition,
  assertRevisionAllowed,
  autoValidateAt,
  commissionFor,
} from './marketplace.rules.js';

export type OrderRow = Selectable<ServiceOrdersTable>;

export function toOrder(row: OrderRow): ServiceOrder {
  return {
    id: row.id,
    listing_id: row.listing_id,
    package_id: row.package_id,
    slot_id: row.slot_id,
    client_id: row.client_id,
    provider_id: row.provider_id,
    requirements: row.requirements,
    status: row.status,
    amount_fcfa: row.amount_fcfa,
    commission_pct: Number(row.commission_pct),
    commission_fcfa: row.commission_fcfa,
    provider_net_fcfa: row.amount_fcfa - row.commission_fcfa,
    revisions_used: row.revisions_used,
    revisions_limit: row.revisions_limit,
    auto_validate_at: row.auto_validate_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  };
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(MARKETPLACE_CLOCK) private readonly now: () => Date,
    @Inject(PAYMENTS_GATEWAY) private readonly payments: PaymentsGateway,
    @Inject(ENTITLEMENTS_GATEWAY) private readonly entitlements: EntitlementsGateway,
  ) {}

  async create(
    clientId: string,
    input: { listing_id: string; package_id?: string; slot_id?: string; requirements?: string },
  ): Promise<ServiceOrder> {
    const listing = await db
      .selectFrom('service_listings')
      .selectAll()
      .where('id', '=', input.listing_id)
      .executeTakeFirst();
    if (!listing) {
      throw notFound('Offre');
    }
    if (listing.status !== 'active') {
      throw new AppError('LISTING_NOT_ACTIVE', 'Cette offre n’est pas disponible');
    }
    if (listing.owner_id === clientId) {
      throw new AppError('SELF_ORDER_FORBIDDEN', 'Tu ne peux pas commander ta propre offre');
    }

    const packages = await db
      .selectFrom('listing_packages')
      .selectAll()
      .where('listing_id', '=', listing.id)
      .execute();
    const chosen = input.package_id
      ? packages.find((item) => item.id === input.package_id)
      : (packages.find((item) => item.tier === 'basic') ?? packages[0]);
    if (!chosen) {
      throw notFound('Formule');
    }

    if (input.slot_id) {
      const slot = await db
        .selectFrom('listing_availability')
        .selectAll()
        .where('id', '=', input.slot_id)
        .where('listing_id', '=', listing.id)
        .executeTakeFirst();
      if (!slot) {
        throw notFound('Créneau');
      }
      if (slot.booked) {
        throw new AppError('SLOT_ALREADY_BOOKED', 'Ce créneau est déjà pris');
      }
    }

    // Commission figée maintenant : un changement de plan ne la modifiera plus.
    const pct = await this.entitlements.commissionPct(listing.owner_id);
    const commission = commissionFor(chosen.price_fcfa, pct);

    const row = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('service_orders')
        .values({
          listing_id: listing.id,
          package_id: chosen.id,
          slot_id: input.slot_id ?? null,
          client_id: clientId,
          provider_id: listing.owner_id,
          requirements: input.requirements ?? null,
          amount_fcfa: chosen.price_fcfa,
          commission_pct: String(commission.pct),
          commission_fcfa: commission.commissionFcfa,
          revisions_limit: chosen.revisions,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (input.slot_id) {
        await trx
          .updateTable('listing_availability')
          .set({ booked: true })
          .where('id', '=', input.slot_id)
          .execute();
      }
      await this.event(trx, created.id, 'requested', clientId);
      return created;
    });

    return toOrder(row);
  }

  async list(
    userId: string,
    role: 'client' | 'provider',
    status?: string,
  ): Promise<ServiceOrder[]> {
    let select = db
      .selectFrom('service_orders')
      .selectAll()
      .where(role === 'client' ? 'client_id' : 'provider_id', '=', userId);
    if (status) {
      select = select.where('status', '=', status as OrderRow['status']);
    }
    const rows = await select.orderBy('created_at', 'desc').limit(50).execute();
    return rows.map(toOrder);
  }

  async get(userId: string, orderId: string): Promise<ServiceOrder> {
    return toOrder(await this.requireParticipant(userId, orderId));
  }

  async events(userId: string, orderId: string) {
    await this.requireParticipant(userId, orderId);
    const rows = await db
      .selectFrom('service_order_events')
      .selectAll()
      .where('order_id', '=', orderId)
      .orderBy('created_at', 'asc')
      .execute();
    return rows.map((row) => ({
      type: row.type,
      actor_id: row.actor_id,
      at: row.created_at.toISOString(),
      meta: (row.meta ?? {}) as Record<string, unknown>,
    }));
  }

  async accept(providerId: string, orderId: string): Promise<ServiceOrder> {
    const order = await this.requireProvider(providerId, orderId);
    await this.transition(order, 'accepted', providerId);
    return this.get(providerId, orderId);
  }

  async pay(
    clientId: string,
    orderId: string,
    input: { provider: 'mtn_momo' | 'orange_money'; phone_msisdn: string },
  ): Promise<ServiceOrder> {
    const order = await this.requireClient(clientId, orderId);
    if (order.status !== 'accepted') {
      throw new AppError('INVALID_STATE', 'La commande doit être acceptée avant paiement');
    }

    const intent = await this.payments.createEscrow({
      objectType: 'order',
      objectId: order.id,
      amountFcfa: order.amount_fcfa,
      provider: input.provider,
      phoneMsisdn: input.phone_msisdn,
    });

    await this.transition(order, 'funded', clientId, { payment_id: intent.paymentId });
    return this.get(clientId, orderId);
  }

  async start(providerId: string, orderId: string): Promise<ServiceOrder> {
    const order = await this.requireProvider(providerId, orderId);
    if (order.status !== 'funded') {
      throw new AppError('INVALID_STATE', 'Le séquestre doit être financé avant de démarrer');
    }
    await this.transition(order, 'in_progress', providerId);
    return this.get(providerId, orderId);
  }

  async deliver(
    providerId: string,
    orderId: string,
    input: { note?: string; file_upload_ids: string[] },
  ): Promise<ServiceOrder> {
    const order = await this.requireProvider(providerId, orderId);
    if (order.status !== 'in_progress') {
      throw new AppError('INVALID_STATE', 'La commande doit être en cours');
    }
    const now = this.now();
    await this.transition(order, 'delivered', providerId, {
      delivered_at: now,
      auto_validate_at: autoValidateAt(now),
    });
    await this.event(db, orderId, 'delivery_details', providerId, {
      ...(input.note === undefined ? {} : { note: input.note }),
      file_upload_ids: input.file_upload_ids,
    });
    return this.get(providerId, orderId);
  }

  async requestRevision(clientId: string, orderId: string, reason: string): Promise<ServiceOrder> {
    const order = await this.requireClient(clientId, orderId);
    assertRevisionAllowed({
      status: order.status,
      used: order.revisions_used,
      limit: order.revisions_limit,
    });
    await this.transition(order, 'in_progress', clientId, {
      revisions_used: order.revisions_used + 1,
    });
    await this.event(db, orderId, 'revision_requested', clientId, { reason });
    return this.get(clientId, orderId);
  }

  async complete(clientId: string, orderId: string): Promise<ServiceOrder> {
    const order = await this.requireClient(clientId, orderId);
    if (order.status !== 'delivered') {
      throw new AppError('INVALID_STATE', 'La commande doit être livrée');
    }
    if (order.payment_id) {
      await this.payments.release(order.payment_id, order.amount_fcfa - order.commission_fcfa);
    }
    await this.transition(order, 'completed', clientId, { completed_at: this.now() });
    return this.get(clientId, orderId);
  }

  async cancel(userId: string, orderId: string, reason?: string): Promise<void> {
    const order = await this.requireParticipant(userId, orderId);
    if (!['requested', 'accepted', 'funded', 'in_progress'].includes(order.status)) {
      throw new AppError('INVALID_STATE', 'Cette commande ne peut plus être annulée');
    }
    if (order.payment_id) {
      await this.payments.refund(order.payment_id);
    }

    await db.transaction().execute(async (trx) => {
      if (order.slot_id) {
        await trx
          .updateTable('listing_availability')
          .set({ booked: false })
          .where('id', '=', order.slot_id)
          .execute();
      }
      await trx
        .updateTable('service_orders')
        .set({ status: 'cancelled', cancelled_at: this.now() })
        .where('id', '=', orderId)
        .execute();
      await this.event(trx, orderId, 'cancelled', userId, {
        ...(reason === undefined ? {} : { reason }),
      });
    });
  }

  async dispute(
    userId: string,
    orderId: string,
    input: { reason: string; evidence_upload_ids: string[] },
  ): Promise<void> {
    const order = await this.requireParticipant(userId, orderId);
    if (!['funded', 'in_progress', 'delivered'].includes(order.status)) {
      throw new AppError('INVALID_STATE', 'Ce litige ne peut pas être ouvert à cette étape');
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('order_disputes')
        .values({
          order_id: orderId,
          opened_by: userId,
          reason: input.reason,
          evidence_upload_ids: input.evidence_upload_ids,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
      await this.transition(order, 'disputed', userId, {}, trx);
    });
  }

  async review(
    userId: string,
    orderId: string,
    input: { rating: number; comment?: string },
  ): Promise<void> {
    const order = await this.requireParticipant(userId, orderId);
    if (order.status !== 'completed') {
      throw new AppError('ORDER_NOT_COMPLETED', 'L’avis ouvre après une commande terminée');
    }
    const targetId = order.client_id === userId ? order.provider_id : order.client_id;

    await db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto('order_reviews')
        .values({
          order_id: orderId,
          author_id: userId,
          target_id: targetId,
          rating: input.rating,
          comment: input.comment ?? null,
        })
        .onConflict((oc) => oc.doNothing())
        .returning('id')
        .executeTakeFirst();
      if (!inserted) {
        throw new AppError('INVALID_STATE', 'Avis déjà publié');
      }

      const stats = await trx
        .selectFrom('order_reviews')
        .innerJoin('service_orders', 'service_orders.id', 'order_reviews.order_id')
        .select(['order_reviews.rating'])
        .where('service_orders.listing_id', '=', order.listing_id)
        .execute();
      const average =
        stats.reduce((total, row) => total + row.rating, 0) / Math.max(1, stats.length);
      await trx
        .updateTable('service_listings')
        .set({ rating_avg: String(average.toFixed(2)), rating_count: stats.length })
        .where('id', '=', order.listing_id)
        .execute();
    });
  }

  // --- internes ----------------------------------------------------------

  async requireParticipant(userId: string, orderId: string): Promise<OrderRow> {
    const row = await db
      .selectFrom('service_orders')
      .selectAll()
      .where('id', '=', orderId)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Commande');
    }
    if (row.client_id !== userId && row.provider_id !== userId) {
      throw forbidden('Tu ne participes pas à cette commande');
    }
    return row;
  }

  async requireProvider(userId: string, orderId: string): Promise<OrderRow> {
    const row = await this.requireParticipant(userId, orderId);
    if (row.provider_id !== userId) {
      throw forbidden('Action réservée au prestataire');
    }
    return row;
  }

  async requireClient(userId: string, orderId: string): Promise<OrderRow> {
    const row = await this.requireParticipant(userId, orderId);
    if (row.client_id !== userId) {
      throw forbidden('Action réservée au client');
    }
    return row;
  }

  private async transition(
    order: OrderRow,
    to: OrderRow['status'],
    actorId: string,
    patch: Record<string, unknown> = {},
    trx?: Kysely<MarketplaceDb>,
  ): Promise<void> {
    assertOrderTransition(order.status, to);
    const run = async (executor: Kysely<MarketplaceDb>) => {
      await executor
        .updateTable('service_orders')
        .set({ status: to, ...patch })
        .where('id', '=', order.id)
        .where('status', '=', order.status)
        .execute();
      await this.event(executor, order.id, to, actorId);
    };
    if (trx) {
      await run(trx);
    } else {
      await db.transaction().execute(run);
    }
  }

  private async event(
    executor: Kysely<MarketplaceDb>,
    orderId: string,
    type: string,
    actorId: string,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    await executor
      .insertInto('service_order_events')
      .values({ order_id: orderId, type, actor_id: actorId, meta })
      .execute();
  }
}
