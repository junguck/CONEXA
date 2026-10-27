import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  CreateNotificationInput,
  CreateThreadInput,
  Message,
  Notification,
  SendMessageInput,
  Thread,
} from '@conexa/contracts';
import { forbidden, notFound } from '@conexa/errors';

import { assertMessageAllowed } from './chat-filter.js';
import { env } from './config.js';
import { db } from './db.js';

interface ThreadRow {
  id: string;
  scope: Thread['scope'];
  object_id: string;
  created_at: Date;
  last_message_at: Date | null;
}

interface MessageRow {
  id: string;
  thread_id: string;
  sender_id: string | null;
  kind: Message['kind'];
  body: string | null;
  card_type: string | null;
  payload: Record<string, unknown> | null;
  created_at: Date;
}

const MESSAGE_COLUMNS = [
  'id',
  'thread_id',
  'sender_id',
  'kind',
  'body',
  'card_type',
  'payload',
  'created_at',
] as const;

@Injectable()
export class MessagingService {
  private readonly now = () => new Date();

  /**
   * Un fil est créé par un domaine (match, commande, mission, date) : les
   * participants sont fixés par l'appelant, jamais par le navigateur.
   */
  async createThread(input: CreateThreadInput & { createdBy?: string }): Promise<Thread> {
    const existing = await db
      .selectFrom('threads')
      .select(['id', 'scope', 'object_id', 'created_at', 'last_message_at'])
      .where('scope', '=', input.scope)
      .where('object_id', '=', input.object_id)
      .executeTakeFirst();

    if (existing) {
      return this.toThread(existing, await this.participantsOf(existing.id));
    }

    const id = randomUUID();
    const participants = [...new Set(input.participant_ids)];

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('threads')
        .values({ id, scope: input.scope, object_id: input.object_id })
        .execute();
      await trx
        .insertInto('thread_participants')
        .values(participants.map((userId) => ({ thread_id: id, user_id: userId })))
        .execute();
      await trx
        .insertInto('messages')
        .values({
          id: randomUUID(),
          thread_id: id,
          sender_id: null,
          kind: 'system',
          body: `Fil ${input.scope} ouvert`,
        })
        .execute();
    });

    const row = await this.loadThread(id);
    return this.toThread(row, participants);
  }

  async listThreads(userId: string): Promise<Thread[]> {
    const rows = await db
      .selectFrom('threads')
      .innerJoin('thread_participants', 'thread_participants.thread_id', 'threads.id')
      .select([
        'threads.id',
        'threads.scope',
        'threads.object_id',
        'threads.created_at',
        'threads.last_message_at',
      ])
      .where('thread_participants.user_id', '=', userId)
      .orderBy('threads.last_message_at', 'desc')
      .limit(50)
      .execute();

    const threads: Thread[] = [];
    for (const row of rows) {
      threads.push(this.toThread(row, await this.participantsOf(row.id)));
    }
    return threads;
  }

  async listMessages(userId: string, threadId: string, before?: string): Promise<Message[]> {
    await this.assertParticipant(threadId, userId);
    let query = db
      .selectFrom('messages')
      .select(MESSAGE_COLUMNS)
      .where('thread_id', '=', threadId)
      .orderBy('created_at', 'desc')
      .limit(env.MESSAGING_PAGE_SIZE);

    if (before) {
      const cursor = new Date(before);
      if (!Number.isNaN(cursor.getTime())) {
        query = query.where('created_at', '<', cursor);
      }
    }

    const rows = await query.execute();
    return rows.reverse().map((row) => this.toMessage(row));
  }

  async sendMessage(userId: string, threadId: string, input: SendMessageInput): Promise<Message> {
    await this.assertParticipant(threadId, userId);

    if (input.kind === 'text') {
      assertMessageAllowed(input.body);
    }

    const id = randomUUID();
    const row = await db.transaction().execute(async (trx) => {
      const message = await trx
        .insertInto('messages')
        .values({
          id,
          thread_id: threadId,
          sender_id: userId,
          kind: input.kind,
          body: input.kind === 'text' ? input.body : null,
          card_type: input.kind === 'card' ? input.card_type : null,
          payload: input.kind === 'card' ? input.payload : null,
        })
        .returning(MESSAGE_COLUMNS)
        .executeTakeFirstOrThrow();

      await trx
        .updateTable('threads')
        .set({ last_message_at: this.now() })
        .where('id', '=', threadId)
        .execute();

      return message;
    });

    return this.toMessage(row);
  }

  async markRead(userId: string, threadId: string): Promise<void> {
    await this.assertParticipant(threadId, userId);
    await db
      .updateTable('thread_participants')
      .set({ last_read_at: this.now() })
      .where('thread_id', '=', threadId)
      .where('user_id', '=', userId)
      .execute();
  }

  async notify(input: CreateNotificationInput): Promise<Notification> {
    const row = await db
      .insertInto('notifications')
      .values({
        id: randomUUID(),
        user_id: input.user_id,
        type: input.type,
        payload: input.payload,
      })
      .returning(['id', 'type', 'payload', 'read_at', 'created_at'])
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      type: row.type,
      payload: row.payload,
      read: row.read_at !== null,
      created_at: row.created_at.toISOString(),
    };
  }

  async listNotifications(userId: string): Promise<Notification[]> {
    const rows = await db
      .selectFrom('notifications')
      .select(['id', 'type', 'payload', 'read_at', 'created_at'])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      payload: row.payload,
      read: row.read_at !== null,
      created_at: row.created_at.toISOString(),
    }));
  }

  async markNotificationsRead(userId: string): Promise<{ updated: number }> {
    const result = await db
      .updateTable('notifications')
      .set({ read_at: this.now() })
      .where('user_id', '=', userId)
      .where('read_at', 'is', null)
      .executeTakeFirst();
    return { updated: Number(result.numUpdatedRows ?? 0) };
  }

  private async assertParticipant(threadId: string, userId: string): Promise<void> {
    const row = await db
      .selectFrom('thread_participants')
      .select('user_id')
      .where('thread_id', '=', threadId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!row) {
      const exists = await db
        .selectFrom('threads')
        .select('id')
        .where('id', '=', threadId)
        .executeTakeFirst();
      if (!exists) {
        throw notFound('Fil');
      }
      throw forbidden('Fil d’une autre conversation');
    }
  }

  private async loadThread(id: string): Promise<ThreadRow> {
    const row = await db
      .selectFrom('threads')
      .select(['id', 'scope', 'object_id', 'created_at', 'last_message_at'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) {
      throw notFound('Fil');
    }
    return row;
  }

  private async participantsOf(threadId: string): Promise<string[]> {
    const rows = await db
      .selectFrom('thread_participants')
      .select('user_id')
      .where('thread_id', '=', threadId)
      .execute();
    return rows.map((row) => row.user_id);
  }

  private toThread(row: ThreadRow, participants: string[]): Thread {
    return {
      id: row.id,
      scope: row.scope,
      object_id: row.object_id,
      participants,
      created_at: row.created_at.toISOString(),
      last_message_at: row.last_message_at?.toISOString() ?? null,
    };
  }

  private toMessage(row: MessageRow): Message {
    return {
      id: row.id,
      thread_id: row.thread_id,
      sender_id: row.sender_id,
      kind: row.kind,
      body: row.body,
      card_type: row.card_type,
      payload: row.payload,
      created_at: row.created_at.toISOString(),
    };
  }
}
