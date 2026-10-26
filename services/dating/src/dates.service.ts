import { Inject, Injectable } from '@nestjs/common';
import type { DateCard, DatingDate, SendCardInput } from '@conexa/contracts';
import { DATE_COMMISSION_PCT } from '@conexa/contracts';
import { AppError, forbidden, notFound } from '@conexa/errors';
import type { Selectable } from 'kysely';

import { payloadFor } from './cards.js';
import { env } from './config.js';
import { db } from './db.js';
import type { DatesTable } from './db.js';
import { DATING_CLOCK } from './profile.js';
import { cancellableUntil, canCancelDate, canRevealContact } from './rules.js';

export type DateRow = Selectable<DatesTable>;

export interface DateOrderInput {
  menu_item_id: string;
  quantity: number;
  unit_price_fcfa: number;
}

@Injectable()
export class DatesService {
  constructor(@Inject(DATING_CLOCK) private readonly now: () => Date) {}

  async list(userId: string, status?: string): Promise<DatingDate[]> {
    let select = db
      .selectFrom('dates')
      .selectAll()
      .where((eb) => eb.or([eb('user_a', '=', userId), eb('user_b', '=', userId)]));
    if (status) {
      select = select.where('status', '=', status as DateRow['status']);
    }
    const rows = await select.orderBy('created_at', 'desc').limit(50).execute();
    return Promise.all(rows.map((row) => this.toDate(row, userId)));
  }

  async get(userId: string, dateId: string): Promise<DatingDate> {
    return this.toDate(await this.requireDate(userId, dateId), userId);
  }

  async cards(userId: string, dateId: string): Promise<DateCard[]> {
    await this.requireDate(userId, dateId);
    const rows = await db
      .selectFrom('date_cards')
      .selectAll()
      .where('date_id', '=', dateId)
      .orderBy('created_at', 'asc')
      .execute();
    return rows.map((row) => ({
      id: row.id,
      sender_id: row.sender_id,
      card_type: row.card_type,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      created_at: row.created_at.toISOString(),
    }));
  }

  async sendCard(userId: string, dateId: string, input: SendCardInput): Promise<DateCard> {
    const date = await this.requireDate(userId, dateId);
    const payload = payloadFor(input.card_type, input.payload);

    if (input.card_type === 'FORMULA_SELECT' && date.payer_id !== userId) {
      throw forbidden('Seul le payeur choisit la formule');
    }
    if (input.card_type === 'SLOT_ACCEPT') {
      await this.lockSlot(dateId, payload.slot_id as string);
    }

    const row = await db
      .insertInto('date_cards')
      .values({ date_id: dateId, sender_id: userId, card_type: input.card_type, payload })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      sender_id: row.sender_id,
      card_type: row.card_type,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      created_at: row.created_at.toISOString(),
    };
  }

  /** Verrouille un créneau : capacité décrémentée une seule fois. */
  async setSlot(userId: string, dateId: string, slotId: string): Promise<DatingDate> {
    await this.requireDate(userId, dateId);
    await this.lockSlot(dateId, slotId);
    return this.get(userId, dateId);
  }

  async setFormula(userId: string, dateId: string, formulaId: string): Promise<DatingDate> {
    const date = await this.requireDate(userId, dateId);
    if (date.payer_id !== userId) {
      throw forbidden('Seul le payeur choisit la formule');
    }
    const formula = await db
      .selectFrom('restaurant_formulas')
      .selectAll()
      .where('id', '=', formulaId)
      .executeTakeFirst();
    if (!formula) {
      throw notFound('Formule');
    }
    await db.updateTable('dates').set({ formula_id: formulaId }).where('id', '=', dateId).execute();
    return this.get(userId, dateId);
  }

  async addOrders(
    userId: string,
    dateId: string,
    input: { items: DateOrderInput[]; allergy_note?: string },
  ): Promise<DatingDate> {
    const date = await this.requireDate(userId, dateId);
    if (!date.formula_id) {
      throw new AppError('INVALID_STATE', 'Choisis une formule avant de commander');
    }
    const formula = await db
      .selectFrom('restaurant_formulas')
      .selectAll()
      .where('id', '=', date.formula_id)
      .executeTakeFirstOrThrow();

    const mine = await db
      .selectFrom('date_orders')
      .select(['quantity', 'unit_price_fcfa'])
      .where('date_id', '=', dateId)
      .where('user_id', '=', userId)
      .execute();
    const alreadySpent = mine.reduce(
      (total, order) => total + order.quantity * order.unit_price_fcfa,
      0,
    );
    const requested = input.items.reduce(
      (total, item) => total + item.quantity * item.unit_price_fcfa,
      0,
    );
    if (alreadySpent + requested > formula.per_person_cap_fcfa) {
      throw new AppError('FORMULA_CAP_EXCEEDED', 'Ta sélection dépasse le plafond de la formule', {
        cap_fcfa: formula.per_person_cap_fcfa,
      });
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('date_orders')
        .values(
          input.items.map((item) => ({
            date_id: dateId,
            user_id: userId,
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            unit_price_fcfa: item.unit_price_fcfa,
            allergy_note: input.allergy_note ?? null,
          })),
        )
        .execute();
      await this.refreshTotal(trx, dateId);
    });

    return this.get(userId, dateId);
  }

  /**
   * Paiement v1 : aucun mouvement d’argent. La passerelle Payments n’existe pas
   * encore (T-0014) ; on renvoie un identifiant d’intention et on confirme le date.
   * Le branchement réel remplacera ce double sans changer les transitions.
   */
  async pay(userId: string, dateId: string): Promise<{ payment_id: string; status: string }> {
    const date = await this.requireDate(userId, dateId);
    if (date.payer_id !== userId) {
      throw forbidden('Seul le payeur règle ce date');
    }
    if (date.status !== 'negotiating' && date.status !== 'awaiting_payment') {
      throw new AppError('INVALID_STATE', 'Ce date n’attend pas de paiement');
    }
    if (!date.slot_id) {
      throw new AppError('INVALID_STATE', 'Choisis un créneau avant de payer');
    }

    await db.updateTable('dates').set({ status: 'confirmed' }).where('id', '=', dateId).execute();

    return { payment_id: `pay_${dateId}`, status: 'escrow' };
  }

  async cancel(userId: string, dateId: string): Promise<void> {
    const date = await this.requireDate(userId, dateId);
    if (date.status === 'cancelled' || date.status === 'completed') {
      throw new AppError('INVALID_STATE', 'Ce date ne peut plus être annulé');
    }
    const startsAt = await this.slotStartsAt(date);
    if (!canCancelDate(startsAt, this.now())) {
      throw new AppError('CANCEL_WINDOW_CLOSED', 'Annulation impossible à moins de 3 h');
    }

    await db.transaction().execute(async (trx) => {
      if (date.slot_id) {
        const slot = await trx
          .selectFrom('restaurant_slots')
          .select(['booked'])
          .where('id', '=', date.slot_id)
          .executeTakeFirst();
        if (slot && slot.booked > 0) {
          await trx
            .updateTable('restaurant_slots')
            .set({ booked: slot.booked - 1 })
            .where('id', '=', date.slot_id)
            .execute();
        }
      }
      await trx
        .updateTable('dates')
        .set({ status: 'cancelled', cancelled_at: this.now(), slot_id: null })
        .where('id', '=', dateId)
        .execute();
    });
  }

  async checkin(userId: string, dateId: string, code: string): Promise<DatingDate> {
    const date = await this.requireDate(userId, dateId);
    if (date.status !== 'confirmed') {
      throw new AppError('INVALID_STATE', 'Le check-in ouvre une fois le date confirmé');
    }
    if (code !== date.checkin_code) {
      throw new AppError('INVALID_STATE', 'Code de check-in invalide');
    }

    const isA = date.user_a === userId;
    const now = this.now();
    const bothIn = isA ? date.checked_in_b_at !== null : date.checked_in_a_at !== null;

    await db
      .updateTable('dates')
      .set({
        ...(isA ? { checked_in_a_at: now } : { checked_in_b_at: now }),
        ...(bothIn ? { status: 'checked_in' } : {}),
      })
      .where('id', '=', dateId)
      .execute();

    return this.get(userId, dateId);
  }

  async sos(userId: string, dateId: string): Promise<void> {
    const date = await this.requireDate(userId, dateId);
    if (date.status === 'cancelled' || date.status === 'completed') {
      throw new AppError('INVALID_STATE', 'Ce date est terminé');
    }
    await db.insertInto('date_sos').values({ date_id: dateId, user_id: userId }).execute();
  }

  async feedback(
    userId: string,
    dateId: string,
    input: { wants_contact: boolean; criteria: Record<string, number> },
  ): Promise<void> {
    const date = await this.requireDate(userId, dateId);
    if (date.status !== 'checked_in' && date.status !== 'completed') {
      throw new AppError('INVALID_STATE', 'Le retour ouvre après le date');
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('date_feedback')
        .values({
          date_id: dateId,
          user_id: userId,
          wants_contact: input.wants_contact,
          criteria: input.criteria,
        })
        .onConflict((oc) =>
          oc.columns(['date_id', 'user_id']).doUpdateSet({
            wants_contact: input.wants_contact,
            criteria: input.criteria,
          }),
        )
        .execute();

      const feedbacks = await trx
        .selectFrom('date_feedback')
        .select('user_id')
        .where('date_id', '=', dateId)
        .execute();
      if (feedbacks.length === 2) {
        await trx
          .updateTable('dates')
          .set({ status: 'completed', completed_at: this.now() })
          .where('id', '=', dateId)
          .execute();
      }
    });
  }

  /** Le numéro n'est révélé qu'après deux « oui » et un date honoré. */
  async contact(userId: string, dateId: string): Promise<{ whatsapp: string }> {
    const date = await this.requireDate(userId, dateId);
    const partnerId = date.user_a === userId ? date.user_b : date.user_a;
    const feedbacks = await db
      .selectFrom('date_feedback')
      .selectAll()
      .where('date_id', '=', dateId)
      .execute();
    const mine = feedbacks.find((row) => row.user_id === userId) ?? null;
    const partner = feedbacks.find((row) => row.user_id === partnerId) ?? null;

    const revealed = canRevealContact({
      status: date.status,
      myFeedback: mine,
      partnerFeedback: partner,
    });
    if (!revealed) {
      throw new AppError('CONTACT_NOT_REVEALED', 'Le contact n’est pas encore révélé');
    }

    const whatsapp = await this.fetchWhatsapp(partnerId);
    if (!date.contact_revealed_at) {
      await db
        .updateTable('dates')
        .set({ contact_revealed_at: this.now() })
        .where('id', '=', dateId)
        .execute();
    }
    return { whatsapp };
  }

  // --- internes ----------------------------------------------------------

  async requireDate(userId: string, dateId: string): Promise<DateRow> {
    const row = await db
      .selectFrom('dates')
      .selectAll()
      .where('id', '=', dateId)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Date');
    }
    if (row.user_a !== userId && row.user_b !== userId) {
      throw forbidden('Tu ne participes pas à ce date');
    }
    return row;
  }

  async toDate(row: DateRow, userId: string): Promise<DatingDate> {
    const slot = row.slot_id
      ? await db
          .selectFrom('restaurant_slots')
          .select(['starts_at'])
          .where('id', '=', row.slot_id)
          .executeTakeFirst()
      : undefined;
    const startsAt = slot?.starts_at ?? null;
    const now = this.now();

    return {
      id: row.id,
      status: row.status,
      partner_id: row.user_a === userId ? row.user_b : row.user_a,
      payer_id: row.payer_id,
      i_am_payer: row.payer_id === userId,
      restaurant_id: row.restaurant_id,
      slot_id: row.slot_id,
      formula_id: row.formula_id,
      total_fcfa: row.total_fcfa,
      commission_fcfa: row.commission_fcfa,
      table_label: row.table_label,
      cancellable_until: cancellableUntil(startsAt)?.toISOString() ?? null,
      can_cancel: canCancelDate(startsAt, now),
      contact_revealed: row.contact_revealed_at !== null,
    };
  }

  private async lockSlot(dateId: string, slotId: string): Promise<void> {
    const slot = await db
      .selectFrom('restaurant_slots')
      .selectAll()
      .where('id', '=', slotId)
      .executeTakeFirst();
    if (!slot) {
      throw notFound('Créneau');
    }
    if (slot.booked >= slot.capacity) {
      throw new AppError('SLOT_FULL', 'Ce créneau est complet');
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('restaurant_slots')
        .set({ booked: slot.booked + 1 })
        .where('id', '=', slotId)
        .execute();
      await trx
        .updateTable('dates')
        .set({ slot_id: slotId, restaurant_id: slot.restaurant_id })
        .where('id', '=', dateId)
        .execute();
    });
  }

  private async slotStartsAt(date: DateRow): Promise<Date | null> {
    if (!date.slot_id) {
      return null;
    }
    const slot = await db
      .selectFrom('restaurant_slots')
      .select('starts_at')
      .where('id', '=', date.slot_id)
      .executeTakeFirst();
    return slot?.starts_at ?? null;
  }

  /** Le numéro reste dans Identity : Dating ne fait que le relayer. */
  private async fetchWhatsapp(userId: string): Promise<string> {
    if (!env.IDENTITY_URL || !env.SERVICE_TOKEN) {
      throw new AppError(
        'INTERNAL_ERROR',
        'Passerelle Identity non configurée : révélation du contact indisponible',
      );
    }
    const response = await fetch(`${env.IDENTITY_URL}/internal/users/${userId}/contact`, {
      headers: { 'x-service-token': env.SERVICE_TOKEN },
    });
    if (!response.ok) {
      throw new AppError('INTERNAL_ERROR', 'Identity n’a pas pu fournir le contact');
    }
    const body = (await response.json()) as { whatsapp?: string };
    if (!body.whatsapp) {
      throw new AppError('INTERNAL_ERROR', 'Réponse Identity invalide');
    }
    return body.whatsapp;
  }

  private async refreshTotal(trx: typeof db, dateId: string): Promise<void> {
    const orders = await trx
      .selectFrom('date_orders')
      .select(['quantity', 'unit_price_fcfa'])
      .where('date_id', '=', dateId)
      .execute();
    const total = orders.reduce((sum, order) => sum + order.quantity * order.unit_price_fcfa, 0);
    const commission = Math.round((total * DATE_COMMISSION_PCT) / 100);
    await trx
      .updateTable('dates')
      .set({ total_fcfa: total, commission_fcfa: commission })
      .where('id', '=', dateId)
      .execute();
  }
}
