import type { InboxStore } from './inbox.js';
import type { OutboxRecord, OutboxStore } from './outbox.js';

/** Outbox en mémoire : tests et service d'exemple. Jamais en production. */
export class InMemoryOutboxStore implements OutboxStore {
  private readonly records = new Map<string, OutboxRecord>();

  async enqueue(records: OutboxRecord[]): Promise<void> {
    for (const record of records) this.records.set(record.id, { ...record });
  }

  async claim(limit: number, now: Date): Promise<OutboxRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) => record.status === 'pending' && Date.parse(record.available_at) <= now.getTime(),
      )
      .sort((a, b) => Date.parse(a.available_at) - Date.parse(b.available_at))
      .slice(0, limit)
      .map((record) => ({ ...record }));
  }

  async markPublished(ids: string[]): Promise<void> {
    for (const id of ids) {
      const record = this.records.get(id);
      if (record === undefined) continue;
      record.status = 'published';
      record.last_error = null;
    }
  }

  async markFailed(id: string, error: string, retryAt: Date | null): Promise<void> {
    const record = this.records.get(id);
    if (record === undefined) return;
    record.attempts += 1;
    record.last_error = error;
    if (retryAt === null) {
      record.status = 'failed';
      return;
    }
    record.status = 'pending';
    record.available_at = retryAt.toISOString();
  }

  /** Copie de tous les enregistrements, pour les assertions de test. */
  all(): OutboxRecord[] {
    return [...this.records.values()].map((record) => ({ ...record }));
  }
}

/** Inbox en mémoire : tests et service d'exemple. Jamais en production. */
export class InMemoryInboxStore implements InboxStore {
  private readonly seen = new Set<string>();

  async has(consumer: string, messageId: string): Promise<boolean> {
    return this.seen.has(`${consumer}:${messageId}`);
  }

  async record(consumer: string, messageId: string, _processedAt: Date): Promise<void> {
    this.seen.add(`${consumer}:${messageId}`);
  }
}
