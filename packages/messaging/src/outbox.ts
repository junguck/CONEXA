import type { EventEnvelope } from '@conexa/events';
import { DEFAULT_RETRY_POLICY, nextAttemptAt, type RetryPolicy } from './backoff.js';

export type OutboxStatus = 'pending' | 'published' | 'failed';

export interface OutboxRecord {
  /** = `envelope.id` : sert aussi de clé d'idempotence chez le consommateur. */
  id: string;
  envelope: EventEnvelope;
  status: OutboxStatus;
  attempts: number;
  /** ISO : ne pas republier avant cette date (reprise à délai croissant). */
  available_at: string;
  last_error: string | null;
  created_at: string;
}

/**
 * Port de persistance de l'outbox. L'implémentation SQL canonique est livrée
 * dans `sql/outbox-inbox.sql` ; `enqueue` s'appelle **dans** la transaction
 * métier, ce qui garantit qu'un état enregistré a son événement.
 */
export interface OutboxStore {
  enqueue(records: OutboxRecord[]): Promise<void>;
  claim(limit: number, now: Date): Promise<OutboxRecord[]>;
  markPublished(ids: string[]): Promise<void>;
  /** `retryAt = null` ⇒ file des échecs (plus de reprise automatique). */
  markFailed(id: string, error: string, retryAt: Date | null): Promise<void>;
}

/** Publication sur le bus (échange topic RabbitMQ en production). */
export interface EventPublisher {
  publish(envelopes: EventEnvelope[]): Promise<void>;
}

export interface OutboxDispatcherOptions {
  batchSize?: number;
  maxAttempts?: number;
  policy?: RetryPolicy;
  random?: () => number;
  now?: () => Date;
}

export interface FlushReport {
  published: number;
  retried: number;
  failed: number;
}

/** Enregistrement prêt à insérer avec le reste de la transaction métier. */
export function pendingRecord(envelope: EventEnvelope, now: Date = new Date()): OutboxRecord {
  const iso = now.toISOString();
  return {
    id: envelope.id,
    envelope,
    status: 'pending',
    attempts: 0,
    available_at: iso,
    last_error: null,
    created_at: iso,
  };
}

/**
 * Publie l'outbox par lots. Une publication en échec rejoue le lot entier après
 * un délai croissant ; au-delà de `maxAttempts`, le message part en file des
 * échecs. Livraison au moins une fois : un doublon est possible, jamais une perte.
 */
export class OutboxDispatcher {
  private readonly store: OutboxStore;
  private readonly publisher: EventPublisher;
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly policy: RetryPolicy;
  private readonly random: () => number;
  private readonly now: () => Date;

  constructor(
    store: OutboxStore,
    publisher: EventPublisher,
    options: OutboxDispatcherOptions = {},
  ) {
    this.store = store;
    this.publisher = publisher;
    this.batchSize = options.batchSize ?? 50;
    this.maxAttempts = options.maxAttempts ?? 10;
    this.policy = options.policy ?? DEFAULT_RETRY_POLICY;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? (() => new Date());
  }

  async flush(): Promise<FlushReport> {
    const now = this.now();
    const batch = await this.store.claim(this.batchSize, now);
    const report: FlushReport = { published: 0, retried: 0, failed: 0 };
    if (batch.length === 0) return report;

    try {
      await this.publisher.publish(batch.map((record) => record.envelope));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const record of batch) {
        const attempts = record.attempts + 1;
        if (attempts >= this.maxAttempts) {
          await this.store.markFailed(record.id, message, null);
          report.failed += 1;
        } else {
          const retryAt = nextAttemptAt(attempts, now, this.policy, this.random);
          await this.store.markFailed(record.id, message, retryAt);
          report.retried += 1;
        }
      }
      return report;
    }

    await this.store.markPublished(batch.map((record) => record.id));
    report.published = batch.length;
    return report;
  }
}
