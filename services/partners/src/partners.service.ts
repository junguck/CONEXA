import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  type CreateFormulaInput,
  type CreateMenuItemInput,
  type CreateOfferInput,
  type CreateOrganisationInput,
  type CreateSlotInput,
  type CreateVenueInput,
  type Formula,
  type MenuItem,
  type Offer,
  type Organisation,
  type PartnerStatus,
  type RedeemOfferResult,
  type Slot,
  type Venue,
  type VenueDetail,
} from '@conexa/contracts';
import { forbidden, invalidState, notFound, validationError } from '@conexa/errors';

import { env } from './config.js';
import { db } from './db.js';
import {
  checkSlotWindow,
  discountFor,
  normalizeCity,
  offerBlockedReason,
  overlaps,
  redemptionCode,
} from './partners.rules.js';

@Injectable()
export class PartnersService {
  private readonly now = () => new Date();

  async createOrganisation(userId: string, input: CreateOrganisationInput): Promise<Organisation> {
    const row = await db
      .insertInto('organisations')
      .values({
        id: randomUUID(),
        owner_user_id: userId,
        name: input.name,
        kind: input.kind,
        // Clé de recherche : la casse et les accents ne changent pas le résultat.
        city: normalizeCity(input.city),
        contact_whatsapp: input.contact_whatsapp,
        status: 'pending',
        commission_pct: input.commission_pct,
      })
      .returning(['id', 'name', 'kind', 'city', 'status', 'commission_pct', 'created_at'])
      .executeTakeFirstOrThrow();
    return toOrganisation(row);
  }

  async myOrganisations(userId: string): Promise<Organisation[]> {
    const rows = await db
      .selectFrom('organisations')
      .select(['id', 'name', 'kind', 'city', 'status', 'commission_pct', 'created_at'])
      .where('owner_user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map(toOrganisation);
  }

  async organisation(id: string): Promise<Organisation> {
    const row = await db
      .selectFrom('organisations')
      .select(['id', 'name', 'kind', 'city', 'status', 'commission_pct', 'created_at'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) throw notFound('Organisation');
    return toOrganisation(row);
  }

  /** Validation par l'administration : c'est le seul chemin vers `active`. */
  async setOrganisationStatus(id: string, status: PartnerStatus): Promise<Organisation> {
    const row = await db
      .updateTable('organisations')
      .set({ status })
      .where('id', '=', id)
      .returning(['id', 'name', 'kind', 'city', 'status', 'commission_pct', 'created_at'])
      .executeTakeFirst();
    if (!row) throw notFound('Organisation');
    return toOrganisation(row);
  }

  async setVenueStatus(id: string, status: PartnerStatus): Promise<Venue> {
    const row = await db
      .updateTable('venues')
      .set({ status })
      .where('id', '=', id)
      .returning([
        'id',
        'organisation_id',
        'name',
        'kind',
        'city',
        'address',
        'capacity',
        'price_per_hour_fcfa',
        'status',
        'created_at',
      ])
      .executeTakeFirst();
    if (!row) throw notFound('Lieu');
    return toVenue(row);
  }

  async createVenue(
    userId: string,
    organisationId: string,
    input: CreateVenueInput,
  ): Promise<Venue> {
    const organisation = await this.ownedOrganisation(userId, organisationId);
    if (organisation.status === 'suspended') {
      throw invalidState('Organisation suspendue : aucun lieu ne peut être ajouté');
    }
    const row = await db
      .insertInto('venues')
      .values({
        id: randomUUID(),
        organisation_id: organisationId,
        name: input.name,
        kind: input.kind,
        city: normalizeCity(input.city),
        address: input.address,
        capacity: input.capacity,
        price_per_hour_fcfa: input.price_per_hour_fcfa ?? null,
        status: 'pending',
      })
      .returning([
        'id',
        'organisation_id',
        'name',
        'kind',
        'city',
        'address',
        'capacity',
        'price_per_hour_fcfa',
        'status',
        'created_at',
      ])
      .executeTakeFirstOrThrow();
    return toVenue(row);
  }

  /** Recherche publique : seulement les lieux actifs, ville normalisée. */
  async searchVenues(query: { city?: string; kind?: string }): Promise<Venue[]> {
    let builder = db
      .selectFrom('venues')
      .select([
        'id',
        'organisation_id',
        'name',
        'kind',
        'city',
        'address',
        'capacity',
        'price_per_hour_fcfa',
        'status',
        'created_at',
      ])
      .where('status', '=', 'active');

    if (query.city) builder = builder.where('city', '=', normalizeCity(query.city));
    if (query.kind) builder = builder.where('kind', '=', query.kind);

    const rows = await builder.orderBy('name', 'asc').limit(env.PARTNERS_PAGE_SIZE).execute();
    return rows.map(toVenue);
  }

  async venueDetail(id: string): Promise<VenueDetail> {
    const venue = await db.selectFrom('venues').selectAll().where('id', '=', id).executeTakeFirst();
    if (!venue) throw notFound('Lieu');

    const [menu, formulas, slots] = await Promise.all([
      db
        .selectFrom('menu_items')
        .select(['id', 'venue_id', 'name', 'price_fcfa', 'category', 'available'])
        .where('venue_id', '=', id)
        .orderBy('category', 'asc')
        .orderBy('name', 'asc')
        .execute(),
      db
        .selectFrom('formulas')
        .select(['id', 'venue_id', 'name', 'price_fcfa', 'min_people', 'includes'])
        .where('venue_id', '=', id)
        .orderBy('price_fcfa', 'asc')
        .execute(),
      this.upcomingSlots(id),
    ]);

    return {
      ...toVenue(venue),
      menu: menu.map(toMenuItem),
      formulas: formulas.map(toFormula),
      next_slots: slots,
    };
  }

  async upcomingSlots(venueId: string, day?: string): Promise<Slot[]> {
    let builder = db
      .selectFrom('slots')
      .select(['id', 'venue_id', 'starts_at', 'ends_at', 'capacity', 'price_fcfa', 'status'])
      .where('venue_id', '=', venueId)
      .where('status', '=', 'open')
      .where('starts_at', '>', this.now());

    if (day) {
      const start = new Date(`${day}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime())) {
        throw validationError('Date attendue au format AAAA-MM-JJ');
      }
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      builder = builder.where('starts_at', '>=', start).where('starts_at', '<', end);
    }

    const rows = await builder.orderBy('starts_at', 'asc').limit(env.PARTNERS_NEXT_SLOTS).execute();
    return rows.map(toSlot);
  }

  /** Lieu d'un partenaire : l'appelant doit posséder l'organisation. */
  private async ownedVenue(userId: string, venueId: string) {
    const row = await db
      .selectFrom('venues')
      .innerJoin('organisations', 'organisations.id', 'venues.organisation_id')
      .select(['venues.id', 'venues.organisation_id', 'organisations.owner_user_id'])
      .where('venues.id', '=', venueId)
      .executeTakeFirst();
    if (!row) throw notFound('Lieu');
    if (row.owner_user_id !== userId) {
      throw forbidden('Ce lieu appartient à un autre partenaire');
    }
    return row;
  }

  private async ownedOrganisation(userId: string, organisationId: string) {
    const row = await db
      .selectFrom('organisations')
      .select(['id', 'owner_user_id', 'status', 'city'])
      .where('id', '=', organisationId)
      .executeTakeFirst();
    if (!row) throw notFound('Organisation');
    if (row.owner_user_id !== userId) {
      throw forbidden('Cette organisation appartient à un autre partenaire');
    }
    return row;
  }

  async addMenuItem(
    userId: string,
    venueId: string,
    input: CreateMenuItemInput,
  ): Promise<MenuItem> {
    await this.ownedVenue(userId, venueId);
    const row = await db
      .insertInto('menu_items')
      .values({
        id: randomUUID(),
        venue_id: venueId,
        name: input.name,
        price_fcfa: input.price_fcfa,
        category: input.category,
        available: input.available,
      })
      .returning(['id', 'venue_id', 'name', 'price_fcfa', 'category', 'available'])
      .executeTakeFirstOrThrow();
    return toMenuItem(row);
  }

  async addFormula(userId: string, venueId: string, input: CreateFormulaInput): Promise<Formula> {
    await this.ownedVenue(userId, venueId);
    const row = await db
      .insertInto('formulas')
      .values({
        id: randomUUID(),
        venue_id: venueId,
        name: input.name,
        price_fcfa: input.price_fcfa,
        min_people: input.min_people,
        includes: input.includes,
      })
      .returning(['id', 'venue_id', 'name', 'price_fcfa', 'min_people', 'includes'])
      .executeTakeFirstOrThrow();
    return toFormula(row);
  }

  /** Un créneau ne se chevauche pas avec un créneau ouvert du même lieu. */
  async addSlot(userId: string, venueId: string, input: CreateSlotInput): Promise<Slot> {
    await this.ownedVenue(userId, venueId);
    const startsAt = new Date(input.starts_at);
    const endsAt = new Date(input.ends_at);
    const verdict = checkSlotWindow(startsAt, endsAt, this.now());
    if (!verdict.ok) throw validationError(slotMessage(verdict.reason), { reason: verdict.reason });

    const siblings = await db
      .selectFrom('slots')
      .select(['starts_at', 'ends_at'])
      .where('venue_id', '=', venueId)
      .where('status', '!=', 'closed')
      .where('ends_at', '>', startsAt)
      .execute();
    const clash = siblings.some((slot) =>
      overlaps({ startsAt, endsAt }, { startsAt: slot.starts_at, endsAt: slot.ends_at }),
    );
    if (clash) throw invalidState('Un créneau existe déjà sur cette plage');

    const row = await db
      .insertInto('slots')
      .values({
        id: randomUUID(),
        venue_id: venueId,
        starts_at: startsAt,
        ends_at: endsAt,
        capacity: input.capacity,
        price_fcfa: input.price_fcfa ?? null,
        status: 'open',
      })
      .returning(['id', 'venue_id', 'starts_at', 'ends_at', 'capacity', 'price_fcfa', 'status'])
      .executeTakeFirstOrThrow();
    return toSlot(row);
  }

  /** Une offre hérite de la ville de l'organisation qui l'émet. */
  async createOffer(
    userId: string,
    organisationId: string,
    input: CreateOfferInput,
  ): Promise<Offer> {
    const organisation = await this.ownedOrganisation(userId, organisationId);
    if (organisation.status !== 'active') {
      throw invalidState("Une organisation doit être validée avant d'émettre une offre");
    }
    const row = await db
      .insertInto('offers')
      .values({
        id: randomUUID(),
        organisation_id: organisationId,
        title: input.title,
        kind: input.kind,
        value: input.value,
        city: normalizeCity(input.city || organisation.city),
        quota: input.quota ?? null,
        redeemed_count: 0,
        valid_until: input.valid_until ? new Date(input.valid_until) : null,
      })
      .returning([
        'id',
        'organisation_id',
        'title',
        'kind',
        'value',
        'city',
        'quota',
        'redeemed_count',
        'valid_until',
        'created_at',
      ])
      .executeTakeFirstOrThrow();
    return toOffer(row);
  }

  async searchOffers(city?: string): Promise<Offer[]> {
    let builder = db.selectFrom('offers').select(OFFER_COLUMNS);
    if (city) builder = builder.where('city', '=', normalizeCity(city));
    const rows = await builder
      .orderBy('created_at', 'desc')
      .limit(env.PARTNERS_PAGE_SIZE)
      .execute();
    return rows.map(toOffer);
  }

  /**
   * Retrait d'une offre : une seule fois par utilisateur, quota atome, code
   * remis au comptoir. Le montant remisé est calculé, jamais fourni par le client.
   */
  async redeem(userId: string, offerId: string, amountFcfa?: number): Promise<RedeemOfferResult> {
    const offer = await db
      .selectFrom('offers')
      .select(OFFER_COLUMNS)
      .where('id', '=', offerId)
      .executeTakeFirst();
    if (!offer) throw notFound('Offre');

    const blocked = offerBlockedReason(toOffer(offer), this.now());
    if (blocked) {
      throw invalidState(blocked === 'expired' ? 'Offre expirée' : 'Offre épuisée');
    }

    const already = await db
      .selectFrom('offer_redemptions')
      .select('id')
      .where('offer_id', '=', offerId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (already) throw invalidState('Offre déjà retirée');

    if (amountFcfa !== undefined) {
      // Vérifie que la remise reste dans les bornes du contrat.
      discountFor(amountFcfa, toOffer(offer));
    }

    const code = redemptionCode(Math.random);
    const redeemed = await db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable('offers')
        .set((eb) => ({ redeemed_count: eb('redeemed_count', '+', 1) }))
        .where('id', '=', offerId)
        .where((eb) => eb.or([eb('quota', 'is', null), eb('redeemed_count', '<', eb.ref('quota'))]))
        .returning(OFFER_COLUMNS)
        .executeTakeFirst();
      if (!updated) throw invalidState('Offre épuisée');

      const redemption = await trx
        .insertInto('offer_redemptions')
        .values({ id: randomUUID(), offer_id: offerId, user_id: userId, code })
        .returning(['code', 'offer_id', 'redeemed_at'])
        .executeTakeFirstOrThrow();
      return { updated, redemption };
    });

    return {
      offer: toOffer(redeemed.updated),
      redemption: {
        code: redeemed.redemption.code,
        offer_id: redeemed.redemption.offer_id,
        redeemed_at: redeemed.redemption.redeemed_at.toISOString(),
      },
    };
  }
}

function toOrganisation(row: {
  id: string;
  name: string;
  kind: string;
  city: string;
  status: string;
  commission_pct: number;
  created_at: Date;
}): Organisation {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as Organisation['kind'],
    city: row.city,
    status: row.status as Organisation['status'],
    commission_pct: row.commission_pct,
    created_at: row.created_at.toISOString(),
  };
}

function toVenue(row: {
  id: string;
  organisation_id: string;
  name: string;
  kind: string;
  city: string;
  address: string;
  capacity: number;
  price_per_hour_fcfa: number | null;
  status: string;
  created_at: Date;
}): Venue {
  return {
    id: row.id,
    organisation_id: row.organisation_id,
    name: row.name,
    kind: row.kind,
    city: row.city,
    address: row.address,
    capacity: row.capacity,
    price_per_hour_fcfa: row.price_per_hour_fcfa,
    status: row.status as Venue['status'],
    created_at: row.created_at.toISOString(),
  };
}

function toMenuItem(row: MenuItem): MenuItem {
  return { ...row } as MenuItem;
}

function toFormula(row: Formula): Formula {
  return { ...row } as Formula;
}

function toSlot(row: {
  id: string;
  venue_id: string;
  starts_at: Date;
  ends_at: Date;
  capacity: number;
  price_fcfa: number | null;
  status: string;
}): Slot {
  return {
    id: row.id,
    venue_id: row.venue_id,
    starts_at: row.starts_at.toISOString(),
    ends_at: row.ends_at.toISOString(),
    capacity: row.capacity,
    price_fcfa: row.price_fcfa,
    status: row.status as Slot['status'],
  };
}

const OFFER_COLUMNS = [
  'id',
  'organisation_id',
  'title',
  'kind',
  'value',
  'city',
  'quota',
  'redeemed_count',
  'valid_until',
  'created_at',
] as const;

function toOffer(row: {
  id: string;
  organisation_id: string;
  title: string;
  kind: string;
  value: number;
  city: string;
  quota: number | null;
  redeemed_count: number;
  valid_until: Date | null;
  created_at: Date;
}): Offer {
  return {
    id: row.id,
    organisation_id: row.organisation_id,
    title: row.title,
    kind: row.kind as Offer['kind'],
    value: row.value,
    city: row.city,
    quota: row.quota,
    redeemed_count: row.redeemed_count,
    valid_until: row.valid_until?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  };
}

function slotMessage(reason: string): string {
  if (reason === 'SLOT_IN_PAST') return 'Un créneau ne peut pas commencer dans le passé';
  if (reason === 'SLOT_TOO_SHORT') return 'Un créneau dure au moins 30 minutes';
  return 'Un créneau dure au plus 8 heures';
}
