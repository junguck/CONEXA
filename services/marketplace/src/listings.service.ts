import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateListingInput,
  ListingSearchQuery,
  PackageInput,
  ServiceListing,
  UpdateListingInput,
} from '@conexa/contracts';
import { AppError, forbidden, notFound } from '@conexa/errors';
import { sql, type Selectable } from 'kysely';

import { db } from './db.js';
import type { ListingPackagesTable, ServiceListingsTable } from './db.js';
import { ENTITLEMENTS_GATEWAY, MARKETPLACE_CLOCK, type EntitlementsGateway } from './gateways.js';
import { assertListingAllowed } from './marketplace.rules.js';

type ListingRow = Selectable<ServiceListingsTable>;
type PackageRow = Selectable<ListingPackagesTable>;

function toListing(row: ListingRow, packages: PackageRow[]): ServiceListing {
  return {
    id: row.id,
    owner_id: row.owner_id,
    category_id: row.category_id,
    title: row.title,
    description: row.description,
    pricing: row.pricing,
    delivery_mode: row.delivery_mode,
    location: row.location,
    tags: row.tags,
    status: row.status,
    rating_avg: Number(row.rating_avg),
    rating_count: row.rating_count,
    boost_until: row.boost_until?.toISOString() ?? null,
    packages: packages.map((item) => ({
      id: item.id,
      tier: item.tier,
      name: item.name,
      description: item.description,
      price_fcfa: item.price_fcfa,
      delivery_days: item.delivery_days,
      revisions: item.revisions,
    })),
    created_at: row.created_at.toISOString(),
  };
}

@Injectable()
export class ListingsService {
  constructor(
    @Inject(MARKETPLACE_CLOCK) private readonly now: () => Date,
    @Inject(ENTITLEMENTS_GATEWAY) private readonly entitlements: EntitlementsGateway,
  ) {}

  async categories() {
    return db.selectFrom('service_categories').selectAll().orderBy('name', 'asc').execute();
  }

  async search(
    query: ListingSearchQuery,
  ): Promise<{ data: ServiceListing[]; next_cursor: string | null }> {
    let select = db.selectFrom('service_listings').selectAll().where('status', '=', 'active');

    if (query.q) {
      select = select.where((eb) =>
        eb.or([eb('title', 'ilike', `%${query.q}%`), eb('description', 'ilike', `%${query.q}%`)]),
      );
    }
    if (query.category) {
      select = select.where('category_id', '=', query.category);
    }
    if (query.delivery_mode) {
      select = select.where('delivery_mode', '=', query.delivery_mode);
    }
    if (query.cursor) {
      select = select.where(
        'created_at',
        '<',
        new Date(Buffer.from(query.cursor, 'base64url').toString('utf8')),
      );
    }
    if (query.min_price !== undefined || query.max_price !== undefined) {
      const priced = await db
        .selectFrom('listing_packages')
        .select('listing_id')
        .where((eb) =>
          eb.and([
            ...(query.min_price === undefined ? [] : [eb('price_fcfa', '>=', query.min_price)]),
            ...(query.max_price === undefined ? [] : [eb('price_fcfa', '<=', query.max_price)]),
          ]),
        )
        .execute();
      select = select.where('id', 'in', [...new Set(priced.map((row) => row.listing_id))]);
    }

    select =
      query.sort === 'rating'
        ? select.orderBy('rating_avg', 'desc')
        : query.sort === 'price'
          ? select.orderBy(sql`boost_until desc nulls last`).orderBy('created_at', 'desc')
          : select.orderBy(sql`boost_until desc nulls last`).orderBy('created_at', 'desc');

    const rows = await select.limit(query.limit + 1).execute();
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const packages = await this.packagesFor(page.map((row) => row.id));

    return {
      data: page.map((row) => toListing(row, packages.get(row.id) ?? [])),
      next_cursor:
        rows.length > query.limit && last
          ? Buffer.from(last.created_at.toISOString(), 'utf8').toString('base64url')
          : null,
    };
  }

  async get(listingId: string): Promise<ServiceListing> {
    const row = await db
      .selectFrom('service_listings')
      .selectAll()
      .where('id', '=', listingId)
      .where('status', '!=', 'archived')
      .executeTakeFirst();
    if (!row) {
      throw notFound('Offre');
    }
    const packages = await this.packagesFor([listingId]);
    return toListing(row, packages.get(listingId) ?? []);
  }

  async create(ownerId: string, input: CreateListingInput): Promise<ServiceListing> {
    assertListingAllowed(input.title, input.description, ...input.tags);

    const category = await db
      .selectFrom('service_categories')
      .select('id')
      .where('id', '=', input.category_id)
      .executeTakeFirst();
    if (!category) {
      throw notFound('Catégorie');
    }

    const tiers = input.packages.map((item) => item.tier);
    if (new Set(tiers).size !== tiers.length) {
      throw new AppError('VALIDATION_ERROR', 'Une seule formule par palier');
    }

    const row = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('service_listings')
        .values({
          owner_id: ownerId,
          category_id: input.category_id,
          title: input.title,
          description: input.description,
          pricing: input.pricing,
          delivery_mode: input.delivery_mode,
          location: input.location ?? null,
          tags: input.tags,
          updated_at: this.now(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('listing_packages')
        .values(
          input.packages.map((item) => ({
            listing_id: created.id,
            tier: item.tier,
            name: item.name,
            description: item.description ?? null,
            price_fcfa: item.price_fcfa,
            delivery_days: item.delivery_days,
            revisions: item.revisions,
          })),
        )
        .execute();

      return created;
    });

    return this.get(row.id);
  }

  async update(
    ownerId: string,
    listingId: string,
    input: UpdateListingInput,
  ): Promise<ServiceListing> {
    await this.requireOwned(listingId, ownerId);
    assertListingAllowed(input.title ?? '', input.description ?? '', ...(input.tags ?? []));

    await db
      .updateTable('service_listings')
      .set({
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.location === undefined ? {} : { location: input.location }),
        ...(input.tags === undefined ? {} : { tags: input.tags }),
        ...(input.delivery_mode === undefined ? {} : { delivery_mode: input.delivery_mode }),
        updated_at: this.now(),
      })
      .where('id', '=', listingId)
      .execute();

    return this.get(listingId);
  }

  async putPackages(
    ownerId: string,
    listingId: string,
    packages: PackageInput[],
  ): Promise<ServiceListing> {
    await this.requireOwned(listingId, ownerId);
    const tiers = packages.map((item) => item.tier);
    if (new Set(tiers).size !== tiers.length) {
      throw new AppError('VALIDATION_ERROR', 'Une seule formule par palier');
    }

    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom('listing_packages').where('listing_id', '=', listingId).execute();
      if (packages.length > 0) {
        await trx
          .insertInto('listing_packages')
          .values(
            packages.map((item) => ({
              listing_id: listingId,
              tier: item.tier,
              name: item.name,
              description: item.description ?? null,
              price_fcfa: item.price_fcfa,
              delivery_days: item.delivery_days,
              revisions: item.revisions,
            })),
          )
          .execute();
      }
      await trx
        .updateTable('service_listings')
        .set({ updated_at: this.now() })
        .where('id', '=', listingId)
        .execute();
    });

    return this.get(listingId);
  }

  async putAvailability(
    ownerId: string,
    listingId: string,
    slots: Array<{ starts_at: string; ends_at: string }>,
  ): Promise<void> {
    await this.requireOwned(listingId, ownerId);
    for (const slot of slots) {
      if (new Date(slot.ends_at) <= new Date(slot.starts_at)) {
        throw new AppError('VALIDATION_ERROR', 'Un créneau doit finir après son début');
      }
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('listing_availability')
        .where('listing_id', '=', listingId)
        .where('booked', '=', false)
        .execute();
      if (slots.length > 0) {
        await trx
          .insertInto('listing_availability')
          .values(
            slots.map((slot) => ({
              listing_id: listingId,
              starts_at: new Date(slot.starts_at),
              ends_at: new Date(slot.ends_at),
            })),
          )
          .onConflict((oc) => oc.doNothing())
          .execute();
      }
    });
  }

  async availability(listingId: string, from?: string, to?: string) {
    let select = db
      .selectFrom('listing_availability')
      .selectAll()
      .where('listing_id', '=', listingId);
    if (from) {
      select = select.where('starts_at', '>=', new Date(from));
    }
    if (to) {
      select = select.where('starts_at', '<=', new Date(to));
    }
    const rows = await select.orderBy('starts_at', 'asc').execute();
    return rows.map((row) => ({
      id: row.id,
      starts_at: row.starts_at.toISOString(),
      ends_at: row.ends_at.toISOString(),
      available: !row.booked,
    }));
  }

  async submit(ownerId: string, listingId: string): Promise<ServiceListing> {
    const listing = await this.requireOwned(listingId, ownerId);
    if (listing.status !== 'draft' && listing.status !== 'paused') {
      throw new AppError('INVALID_STATE', 'Cette offre ne peut pas être soumise');
    }
    const packages = await this.packagesFor([listingId]);
    if ((packages.get(listingId) ?? []).length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Ajoute au moins une formule avant de soumettre');
    }

    const limit = await this.entitlements.maxActiveListings(ownerId);
    const active = await this.countActive(ownerId);
    if (active >= limit) {
      throw new AppError('PLAN_LIMIT_REACHED', 'Toutes tes offres actives sont utilisées', {
        limit,
      });
    }

    await db
      .updateTable('service_listings')
      .set({ status: 'active', paused_reason: null, updated_at: this.now() })
      .where('id', '=', listingId)
      .execute();
    return this.get(listingId);
  }

  async pause(ownerId: string, listingId: string): Promise<void> {
    await this.requireOwned(listingId, ownerId);
    await db
      .updateTable('service_listings')
      .set({ status: 'paused', paused_reason: 'manual', updated_at: this.now() })
      .where('id', '=', listingId)
      .execute();
  }

  async resume(ownerId: string, listingId: string): Promise<void> {
    await this.requireOwned(listingId, ownerId);
    const limit = await this.entitlements.maxActiveListings(ownerId);
    const active = await this.countActive(ownerId);

    if (active >= limit) {
      const oldest = await db
        .selectFrom('service_listings')
        .select('id')
        .where('owner_id', '=', ownerId)
        .where('status', '=', 'active')
        .orderBy('created_at', 'asc')
        .executeTakeFirst();
      if (oldest) {
        // Jamais de suppression : l'offre en excès est mise en pause.
        await db
          .updateTable('service_listings')
          .set({ status: 'paused', paused_reason: 'plan_limit', updated_at: this.now() })
          .where('id', '=', oldest.id)
          .execute();
      }
    }

    await db
      .updateTable('service_listings')
      .set({ status: 'active', paused_reason: null, updated_at: this.now() })
      .where('id', '=', listingId)
      .execute();
  }

  async archive(ownerId: string, listingId: string): Promise<void> {
    await this.requireOwned(listingId, ownerId);
    const open = await db
      .selectFrom('service_orders')
      .select('id')
      .where('listing_id', '=', listingId)
      .where('status', 'in', ['requested', 'accepted', 'funded', 'in_progress', 'delivered'])
      .executeTakeFirst();
    if (open) {
      throw new AppError('INVALID_STATE', 'Des commandes sont encore en cours');
    }
    await db
      .updateTable('service_listings')
      .set({ status: 'archived', updated_at: this.now() })
      .where('id', '=', listingId)
      .execute();
  }

  async favorite(userId: string, listingId: string): Promise<void> {
    await this.get(listingId);
    await db
      .insertInto('listing_favorites')
      .values({ user_id: userId, listing_id: listingId })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async unfavorite(userId: string, listingId: string): Promise<void> {
    await db
      .deleteFrom('listing_favorites')
      .where('user_id', '=', userId)
      .where('listing_id', '=', listingId)
      .execute();
  }

  async favorites(userId: string): Promise<ServiceListing[]> {
    const rows = await db
      .selectFrom('listing_favorites')
      .innerJoin('service_listings', 'service_listings.id', 'listing_favorites.listing_id')
      .selectAll('service_listings')
      .where('listing_favorites.user_id', '=', userId)
      .orderBy('listing_favorites.created_at', 'desc')
      .limit(50)
      .execute();
    const packages = await this.packagesFor(rows.map((row) => row.id));
    return rows.map((row) => toListing(row, packages.get(row.id) ?? []));
  }

  async reviewsFor(listingId: string) {
    const rows = await db
      .selectFrom('order_reviews')
      .innerJoin('service_orders', 'service_orders.id', 'order_reviews.order_id')
      .select([
        'order_reviews.id',
        'order_reviews.author_id',
        'order_reviews.rating',
        'order_reviews.comment',
        'order_reviews.created_at',
      ])
      .where('service_orders.listing_id', '=', listingId)
      .orderBy('order_reviews.created_at', 'desc')
      .limit(50)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      author_id: row.author_id,
      rating: row.rating,
      comment: row.comment,
      created_at: row.created_at.toISOString(),
    }));
  }

  async sellerDashboard(userId: string) {
    const [completed, pending, listings, reviews] = await Promise.all([
      db
        .selectFrom('service_orders')
        .select([
          sql<string>`coalesce(sum(amount_fcfa - commission_fcfa), 0)`.as('net'),
          sql<string>`count(*)`.as('count'),
        ])
        .where('provider_id', '=', userId)
        .where('status', '=', 'completed')
        .executeTakeFirst(),
      db
        .selectFrom('service_orders')
        .select([sql<string>`coalesce(sum(amount_fcfa), 0)`.as('gross')])
        .where('provider_id', '=', userId)
        .where('status', 'in', ['funded', 'in_progress', 'delivered'])
        .executeTakeFirst(),
      db
        .selectFrom('service_listings')
        .select([sql<string>`count(*)`.as('count')])
        .where('owner_id', '=', userId)
        .where('status', '=', 'active')
        .executeTakeFirst(),
      db
        .selectFrom('order_reviews')
        .select([
          sql<string>`coalesce(avg(rating), 0)`.as('avg'),
          sql<string>`count(*)`.as('count'),
        ])
        .where('target_id', '=', userId)
        .executeTakeFirst(),
    ]);

    return {
      earnings_fcfa: Number(completed?.net ?? 0),
      pending_fcfa: Number(pending?.gross ?? 0),
      completed: Number(completed?.count ?? 0),
      rating_avg: Number(reviews?.avg ?? 0),
      active_listings: Number(listings?.count ?? 0),
      listing_limit: await this.entitlements.maxActiveListings(userId),
    };
  }

  // --- internes ----------------------------------------------------------

  private async countActive(ownerId: string): Promise<number> {
    const row = await db
      .selectFrom('service_listings')
      .select(sql<string>`count(*)`.as('count'))
      .where('owner_id', '=', ownerId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async packagesFor(listingIds: string[]): Promise<Map<string, PackageRow[]>> {
    const map = new Map<string, PackageRow[]>();
    if (listingIds.length === 0) {
      return map;
    }
    const rows = await db
      .selectFrom('listing_packages')
      .selectAll()
      .where('listing_id', 'in', listingIds)
      .execute();
    for (const row of rows) {
      map.set(row.listing_id, [...(map.get(row.listing_id) ?? []), row]);
    }
    return map;
  }

  async requireOwned(listingId: string, ownerId: string): Promise<ListingRow> {
    const row = await db
      .selectFrom('service_listings')
      .selectAll()
      .where('id', '=', listingId)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Offre');
    }
    if (row.owner_id !== ownerId) {
      throw forbidden('Seul le propriétaire gère cette offre');
    }
    return row;
  }
}
