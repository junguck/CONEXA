import { Inject, Injectable } from '@nestjs/common';
import {
  CreateMissionSchema,
  DeliverSchema,
  FundMissionSchema,
  type CreateReviewInput,
  type Mission,
  type Review,
} from '@conexa/contracts';
import type { z } from 'zod';
import { AppError, forbidden, notFound } from '@conexa/errors';
import type { Selectable } from 'kysely';

import { db } from './db.js';
import type { MissionsTable } from './db.js';
import {
  ENTITLEMENTS_GATEWAY,
  PAYMENTS_GATEWAY,
  TALENTS_CLOCK,
  type EntitlementsGateway,
  type PaymentsGateway,
} from './gateways.js';
import {
  assertCanReview,
  assertDelivered,
  assertFunded,
  assertMissionTransition,
  commissionFor,
  MIN_MISSION_AMOUNT,
} from './talents.rules.js';

type MissionRow = Selectable<MissionsTable>;

type ProposeInput = z.infer<typeof CreateMissionSchema>;
type FundInput = z.infer<typeof FundMissionSchema>;
type DeliverInput = z.infer<typeof DeliverSchema>;

function toMission(row: MissionRow): Mission {
  return {
    id: row.id,
    post_id: row.post_id,
    client_id: row.client_id,
    provider_id: row.provider_id,
    amount_fcfa: row.amount_fcfa,
    commission_fcfa: row.commission_fcfa,
    provider_net_fcfa: row.amount_fcfa - row.commission_fcfa,
    deadline_at: row.deadline_at?.toISOString() ?? null,
    status: row.status,
    payment_id: row.payment_id,
    created_at: row.created_at.toISOString(),
  };
}

@Injectable()
export class MissionsService {
  constructor(
    @Inject(TALENTS_CLOCK) private readonly now: () => Date,
    @Inject(PAYMENTS_GATEWAY) private readonly payments: PaymentsGateway,
    @Inject(ENTITLEMENTS_GATEWAY) private readonly entitlements: EntitlementsGateway,
  ) {}

  async propose(clientId: string, input: ProposeInput): Promise<Mission> {
    if (input.amount_fcfa < MIN_MISSION_AMOUNT) {
      throw new AppError('VALIDATION_ERROR', `Montant minimum : ${MIN_MISSION_AMOUNT} FCFA`);
    }
    const post = await db
      .selectFrom('posts')
      .select(['author_id', 'status'])
      .where('id', '=', input.post_id)
      .executeTakeFirst();
    if (!post) {
      throw notFound('Publication');
    }
    if (post.author_id !== clientId) {
      throw forbidden('Seul l’auteur de la publication propose une mission');
    }
    if (input.provider_id === clientId) {
      throw new AppError('INVALID_STATE', 'Client et prestataire doivent être différents');
    }

    // Taux lu dans les droits du prestataire, jamais en dur dans le service.
    const commission = commissionFor(
      input.amount_fcfa,
      await this.entitlements.commissionPct(input.provider_id),
    );

    const row = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('missions')
        .values({
          post_id: input.post_id,
          client_id: clientId,
          provider_id: input.provider_id,
          amount_fcfa: input.amount_fcfa,
          commission_fcfa: commission.commissionFcfa,
          commission_pct: String(commission.pct),
          deadline_at: input.deadline_at ? new Date(input.deadline_at) : null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('mission_events')
        .values({ mission_id: created.id, type: 'proposed', actor_id: clientId })
        .execute();
      return created;
    });

    return toMission(row);
  }

  async list(userId: string, role: 'client' | 'provider', status?: string): Promise<Mission[]> {
    let select = db
      .selectFrom('missions')
      .selectAll()
      .where(role === 'client' ? 'client_id' : 'provider_id', '=', userId);
    if (status) {
      select = select.where('status', '=', status as MissionRow['status']);
    }
    const rows = await select.orderBy('created_at', 'desc').limit(50).execute();
    return rows.map(toMission);
  }

  async accept(providerId: string, missionId: string): Promise<Mission> {
    const mission = await this.requireMission(missionId);
    if (mission.provider_id !== providerId) {
      throw forbidden('Seul le prestataire accepte');
    }
    await this.transition(mission, 'accepted', providerId, { accepted_at: this.now() });
    return this.get(missionId);
  }

  async fund(clientId: string, missionId: string, input: FundInput): Promise<Mission> {
    const mission = await this.requireMission(missionId);
    if (mission.client_id !== clientId) {
      throw forbidden('Seul le client finance');
    }
    if (mission.status !== 'accepted') {
      throw new AppError('INVALID_STATE', 'La mission doit être acceptée avant financement');
    }

    const intent = await this.payments.createEscrow({
      objectType: 'mission',
      objectId: mission.id,
      amountFcfa: mission.amount_fcfa,
      provider: input.provider,
      phoneMsisdn: input.phone_msisdn,
    });

    await this.transition(mission, 'funded', clientId, {
      funded_at: this.now(),
      payment_id: intent.paymentId,
    });
    return this.get(missionId);
  }

  async deliver(providerId: string, missionId: string, input: DeliverInput): Promise<Mission> {
    const mission = await this.requireMission(missionId);
    if (mission.provider_id !== providerId) {
      throw forbidden('Seul le prestataire livre');
    }
    assertFunded(mission.status);
    await this.transition(mission, 'delivered', providerId, {
      delivered_at: this.now(),
      delivered_note: input.note ?? null,
      delivered_uploads: input.file_upload_ids,
    });
    return this.get(missionId);
  }

  async approve(clientId: string, missionId: string): Promise<Mission> {
    const mission = await this.requireMission(missionId);
    if (mission.client_id !== clientId) {
      throw forbidden('Seul le client approuve');
    }
    assertDelivered(mission.status);
    if (mission.payment_id) {
      await this.payments.release(
        mission.payment_id,
        mission.amount_fcfa - mission.commission_fcfa,
      );
    }
    await this.transition(mission, 'approved', clientId, { approved_at: this.now() });
    return this.get(missionId);
  }

  async dispute(userId: string, missionId: string, reason: string): Promise<void> {
    const mission = await this.requireMission(missionId);
    if (userId !== mission.client_id && userId !== mission.provider_id) {
      throw forbidden('Seuls les participants contestent');
    }
    await this.transition(mission, 'disputed', userId, { reason });
  }

  async cancel(clientId: string, missionId: string): Promise<void> {
    const mission = await this.requireMission(missionId);
    if (mission.client_id !== clientId) {
      throw forbidden('Seul le client annule');
    }
    if (mission.payment_id) {
      await this.payments.refund(mission.payment_id);
    }
    await this.transition(mission, 'cancelled', clientId, { cancelled_at: this.now() });
  }

  async get(missionId: string): Promise<Mission> {
    return toMission(await this.requireMission(missionId));
  }

  // --- avis --------------------------------------------------------------

  async createReview(userId: string, input: CreateReviewInput): Promise<Review> {
    const mission = await this.requireMission(input.mission_id);
    const targetId = assertCanReview({
      status: mission.status,
      authorId: userId,
      clientId: mission.client_id,
      providerId: mission.provider_id,
    });

    const row = await db
      .insertInto('reviews')
      .values({
        mission_id: mission.id,
        author_id: userId,
        target_id: targetId,
        rating: input.rating,
        comment: input.comment ?? null,
      })
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw new AppError('INVALID_STATE', 'Avis déjà publié pour cette mission');
    }
    return {
      id: row.id,
      mission_id: row.mission_id,
      author_id: row.author_id,
      target_id: row.target_id,
      rating: row.rating,
      comment: row.comment,
      created_at: row.created_at.toISOString(),
    };
  }

  async reviewsFor(userId: string): Promise<Review[]> {
    const rows = await db
      .selectFrom('reviews')
      .selectAll()
      .where('target_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      mission_id: row.mission_id,
      author_id: row.author_id,
      target_id: row.target_id,
      rating: row.rating,
      comment: row.comment,
      created_at: row.created_at.toISOString(),
    }));
  }

  // --- meetups -----------------------------------------------------------

  async proposeMeetup(
    organizerId: string,
    input: { invitee_id: string; post_id?: string; place: string; starts_at: string },
  ): Promise<{ id: string }> {
    if (input.invitee_id === organizerId) {
      throw new AppError('VALIDATION_ERROR', 'Choisis une autre personne');
    }
    const row = await db
      .insertInto('meetups')
      .values({
        organizer_id: organizerId,
        invitee_id: input.invitee_id,
        post_id: input.post_id ?? null,
        place: input.place,
        starts_at: new Date(input.starts_at),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { id: row.id };
  }

  async listMeetups(userId: string) {
    const rows = await db
      .selectFrom('meetups')
      .selectAll()
      .where((eb) => eb.or([eb('organizer_id', '=', userId), eb('invitee_id', '=', userId)]))
      .orderBy('starts_at', 'desc')
      .limit(50)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      organizer_id: row.organizer_id,
      invitee_id: row.invitee_id,
      post_id: row.post_id,
      place: row.place,
      starts_at: row.starts_at.toISOString(),
      status: row.status,
    }));
  }

  async resolveMeetup(userId: string, meetupId: string, accept: boolean): Promise<void> {
    const row = await db
      .selectFrom('meetups')
      .selectAll()
      .where('id', '=', meetupId)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Rencontre');
    }
    if (row.invitee_id !== userId) {
      throw forbidden('Seul l’invité répond');
    }
    if (row.status !== 'proposed') {
      throw new AppError('INVALID_STATE', 'Rencontre déjà traitée');
    }
    await db
      .updateTable('meetups')
      .set({ status: accept ? 'accepted' : 'declined', resolved_at: this.now() })
      .where('id', '=', meetupId)
      .execute();
  }

  // --- internes ----------------------------------------------------------

  async requireMission(missionId: string): Promise<MissionRow> {
    const row = await db
      .selectFrom('missions')
      .selectAll()
      .where('id', '=', missionId)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Mission');
    }
    return row;
  }

  private async transition(
    mission: MissionRow,
    to: MissionRow['status'],
    actorId: string,
    patch: Record<string, unknown> = {},
  ): Promise<void> {
    assertMissionTransition(mission.status, to);
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('missions')
        .set({ status: to, ...patch })
        .where('id', '=', mission.id)
        .where('status', '=', mission.status)
        .execute();
      await trx
        .insertInto('mission_events')
        .values({ mission_id: mission.id, type: to, actor_id: actorId, meta: patch })
        .execute();
    });
  }
}
