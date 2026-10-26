import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  DispatchPushInput,
  DispatchPushResult,
  PushDelivery,
  PushSubscription,
  RegisterSubscriptionInput,
} from '@conexa/contracts';
import { notFound } from '@conexa/errors';
import { createLogger } from '@conexa/service-kit';

import { env } from './config.js';
import { db } from './db.js';
import {
  buildPushMessage,
  nextFailureCount,
  partitionTargets,
  shouldPrune,
} from './notifications.rules.js';
import { createPushSender, deliveryId, maskEndpoint } from './push.provider.js';

const logger = createLogger('notifications');

@Injectable()
export class NotificationsService {
  readonly sender = createPushSender();
  private readonly now = () => new Date();

  /** Le navigateur a besoin de la clé publique pour s'abonner ; null en console. */
  vapidPublicKey(): { channel: string; key: string | null } {
    return {
      channel: this.sender.channel,
      key: this.sender.channel === 'web_push' ? (env.VAPID_PUBLIC_KEY ?? null) : null,
    };
  }

  /**
   * Un endpoint identifie un navigateur : réenregistrer le même remplace les
   * clés et rattache l'abonnement à l'utilisateur courant (jamais l'inverse).
   */
  async register(userId: string, input: RegisterSubscriptionInput): Promise<PushSubscription> {
    const row = await db
      .insertInto('push_subscriptions')
      .values({
        id: randomUUID(),
        user_id: userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        platform: input.platform,
        failure_count: 0,
        last_success_at: null,
      })
      .onConflict((oc) =>
        oc.column('endpoint').doUpdateSet({
          user_id: userId,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          platform: input.platform,
          failure_count: 0,
        }),
      )
      .returning(['id', 'endpoint', 'platform', 'failure_count', 'last_success_at', 'created_at'])
      .executeTakeFirstOrThrow();

    return toSubscription(row);
  }

  async list(userId: string): Promise<PushSubscription[]> {
    const rows = await db
      .selectFrom('push_subscriptions')
      .select(['id', 'endpoint', 'platform', 'failure_count', 'last_success_at', 'created_at'])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map(toSubscription);
  }

  /** Suppression par propriétaire : l'identifiant d'un autre ne supprime rien. */
  async remove(userId: string, id: string): Promise<void> {
    const result = await db
      .deleteFrom('push_subscriptions')
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!result.numDeletedRows || result.numDeletedRows === 0n) {
      throw notFound('Abonnement introuvable');
    }
  }

  async deliveries(userId: string, limit = 50): Promise<PushDelivery[]> {
    const rows = await db
      .selectFrom('push_deliveries')
      .select(['id', 'type', 'channel', 'status', 'error_code', 'created_at'])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      channel: row.channel as PushDelivery['channel'],
      status: row.status,
      error_code: row.error_code,
      created_at: row.created_at.toISOString(),
    }));
  }

  /**
   * Diffuse une notification aux navigateurs d'un utilisateur. Un abonnement en
   * échec n'empêche pas les autres ; chaque tentative est journalisée.
   */
  async dispatch(input: DispatchPushInput): Promise<DispatchPushResult> {
    const rows = await db
      .selectFrom('push_subscriptions')
      .select(['id', 'endpoint', 'p256dh', 'auth', 'failure_count'])
      .where('user_id', '=', input.user_id)
      .execute();

    if (rows.length === 0) {
      return { sent: 0, failed: 0, skipped: 0 };
    }

    const { unique, duplicates } = partitionTargets(rows);
    const message = buildPushMessage(input);
    let sent = 0;
    let failed = 0;

    for (const row of unique) {
      const outcome = await this.sender.send(
        { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
        message,
      );
      const failureCount = nextFailureCount(row.failure_count, outcome);
      const prune = shouldPrune(outcome, failureCount, env.PUSH_MAX_FAILURES);

      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('push_deliveries')
          .values({
            id: deliveryId(),
            subscription_id: row.id,
            user_id: input.user_id,
            type: input.type,
            channel: this.sender.channel,
            status: outcome.status,
            error_code: outcome.errorCode,
          })
          .execute();

        if (prune) {
          await trx.deleteFrom('push_subscriptions').where('id', '=', row.id).execute();
        } else {
          await trx
            .updateTable('push_subscriptions')
            .set({
              failure_count: failureCount,
              ...(outcome.status === 'sent' ? { last_success_at: this.now() } : {}),
            })
            .where('id', '=', row.id)
            .execute();
        }
      });

      if (outcome.status === 'sent') {
        sent += 1;
      } else {
        failed += 1;
        logger.warn(
          { endpoint: maskEndpoint(row.endpoint), code: outcome.errorCode },
          'push refusée',
        );
      }
    }

    return { sent, failed, skipped: duplicates };
  }
}

function toSubscription(row: {
  id: string;
  endpoint: string;
  platform: string;
  failure_count: number;
  last_success_at: Date | null;
  created_at: Date;
}): PushSubscription {
  return {
    id: row.id,
    endpoint: row.endpoint,
    platform: row.platform,
    failure_count: row.failure_count,
    last_success_at: row.last_success_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  };
}
