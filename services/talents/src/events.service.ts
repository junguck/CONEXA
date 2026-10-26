import { Inject, Injectable } from '@nestjs/common';
import type { Event } from '@conexa/contracts';
import { AppError, forbidden, notFound } from '@conexa/errors';
import { sql, type Selectable } from 'kysely';

import { db } from './db.js';
import type { EventsTable } from './db.js';
import { PAYMENTS_GATEWAY, TALENTS_CLOCK, type PaymentsGateway } from './gateways.js';

type EventRow = Selectable<EventsTable>;

@Injectable()
export class EventsService {
  constructor(
    @Inject(TALENTS_CLOCK) private readonly now: () => Date,
    @Inject(PAYMENTS_GATEWAY) private readonly payments: PaymentsGateway,
  ) {}

  async list(from?: string, status?: string): Promise<Event[]> {
    let select = db
      .selectFrom('events')
      .selectAll()
      .where('status', '=', (status ?? 'published') as EventRow['status']);
    select = select.where('starts_at', '>=', from ? new Date(from) : this.now());

    const rows = await select.orderBy('starts_at', 'asc').limit(50).execute();
    const counts = await this.registeredCounts(rows.map((row) => row.id));
    return rows.map((row) => this.toEvent(row, counts.get(row.id) ?? 0));
  }

  async get(eventId: string): Promise<Event> {
    const row = await db
      .selectFrom('events')
      .selectAll()
      .where('id', '=', eventId)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Événement');
    }
    const counts = await this.registeredCounts([eventId]);
    return this.toEvent(row, counts.get(eventId) ?? 0);
  }

  async create(
    userId: string,
    input: {
      title: string;
      description?: string;
      place: string;
      starts_at: string;
      price_fcfa: number;
      capacity?: number;
      sponsor_name?: string;
    },
  ): Promise<Event> {
    const startsAt = new Date(input.starts_at);
    if (startsAt.getTime() <= this.now().getTime()) {
      throw new AppError('VALIDATION_ERROR', 'L’événement doit commencer dans le futur');
    }
    const row = await db
      .insertInto('events')
      .values({
        organizer_id: userId,
        title: input.title,
        description: input.description ?? null,
        place: input.place,
        starts_at: startsAt,
        price_fcfa: input.price_fcfa,
        capacity: input.capacity ?? null,
        sponsor_name: input.sponsor_name ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toEvent(row, 0);
  }

  async register(userId: string, eventId: string): Promise<{ registered: true }> {
    const event = await this.requireEvent(eventId);
    if (event.price_fcfa > 0) {
      throw new AppError('PAYMENT_REQUIRED', 'Cet événement est payant : prends un billet');
    }
    await this.insertRegistration(event, userId, null);
    return { registered: true };
  }

  async ticket(
    userId: string,
    eventId: string,
    input: { provider: 'mtn_momo' | 'orange_money'; phone_msisdn: string },
  ): Promise<{ payment_id: string }> {
    const event = await this.requireEvent(eventId);
    if (event.price_fcfa <= 0) {
      throw new AppError('INVALID_STATE', 'Cet événement est gratuit');
    }
    const intent = await this.payments.createEscrow({
      objectType: 'ticket',
      objectId: event.id,
      amountFcfa: event.price_fcfa,
      provider: input.provider,
      phoneMsisdn: input.phone_msisdn,
    });
    await this.insertRegistration(event, userId, intent.paymentId);
    return { payment_id: intent.paymentId };
  }

  async checkin(organizerId: string, eventId: string, userId: string): Promise<void> {
    const event = await this.requireEvent(eventId);
    if (event.organizer_id !== organizerId) {
      throw forbidden('Seul l’organisateur valide les arrivées');
    }
    const result = await db
      .updateTable('event_registrations')
      .set({ status: 'checked_in', checked_in_at: this.now() })
      .where('event_id', '=', eventId)
      .where('user_id', '=', userId)
      .where('status', '=', 'registered')
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) {
      throw notFound('Inscription');
    }
  }

  // --- internes ----------------------------------------------------------

  private async requireEvent(eventId: string): Promise<EventRow> {
    const row = await db
      .selectFrom('events')
      .selectAll()
      .where('id', '=', eventId)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Événement');
    }
    if (row.status !== 'published') {
      throw new AppError('INVALID_STATE', 'Cet événement n’est pas ouvert');
    }
    return row;
  }

  private async insertRegistration(
    event: EventRow,
    userId: string,
    paymentId: string | null,
  ): Promise<void> {
    if (event.capacity !== null) {
      const counts = await this.registeredCounts([event.id]);
      if ((counts.get(event.id) ?? 0) >= event.capacity) {
        throw new AppError('OFFER_SOLD_OUT', 'Événement complet');
      }
    }
    try {
      await db
        .insertInto('event_registrations')
        .values({ event_id: event.id, user_id: userId, payment_id: paymentId })
        .execute();
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: string }).code === '23505'
      ) {
        throw new AppError('INVALID_STATE', 'Déjà inscrit à cet événement');
      }
      throw error;
    }
  }

  private async registeredCounts(eventIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (eventIds.length === 0) {
      return counts;
    }
    const rows = await db
      .selectFrom('event_registrations')
      .select(['event_id', sql<string>`count(*)`.as('count')])
      .where('event_id', 'in', eventIds)
      .where('status', '!=', 'cancelled')
      .groupBy('event_id')
      .execute();
    for (const row of rows) {
      counts.set(row.event_id, Number(row.count));
    }
    return counts;
  }

  private toEvent(row: EventRow, registered: number): Event {
    return {
      id: row.id,
      organizer_id: row.organizer_id,
      title: row.title,
      description: row.description,
      place: row.place,
      starts_at: row.starts_at.toISOString(),
      price_fcfa: row.price_fcfa,
      capacity: row.capacity,
      sponsor_name: row.sponsor_name,
      status: row.status,
      registered,
    };
  }
}
