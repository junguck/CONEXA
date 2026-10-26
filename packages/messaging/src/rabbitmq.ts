import type { EventEnvelope } from '@conexa/events';

/** Échange topic principal : la routing key est le type d'événement (`user.approved`). */
export const EVENT_EXCHANGE = 'conexa.events';

/** En-tête W3C propagé de bout en bout. */
export const AMQP_TRACEPARENT_HEADER = 'traceparent';

export interface QueueDefinition {
  name: string;
  durable: true;
  arguments?: Record<string, unknown>;
}

export interface BindingDefinition {
  queue: string;
  pattern: string;
}

export interface ServiceTopology {
  exchange: string;
  queues: QueueDefinition[];
  bindings: BindingDefinition[];
}

export const TRACEPARENT_PATTERN = /^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

/** Noms des files d'un service consommateur. */
export function serviceQueueNames(service: string): {
  events: string;
  retry: string;
  failed: string;
} {
  return {
    events: `${service}.events`,
    retry: `${service}.retry`,
    failed: `${service}.failed`,
  };
}

/**
 * Topologie d'un service consommateur :
 * - `events` : file durable principale, liée aux motifs `domaine.action` qu'il consomme ;
 * - `retry` : file durable à TTL qui renvoie vers l'échange — le délai croissant est
 *   décidé par `OutboxDispatcher`, cette file rattrape les messages non acquittés ;
 * - `failed` : file des échecs, examinée par un humain, jamais purgée automatiquement.
 */
export function serviceTopology(
  service: string,
  patterns: string[],
  retryTtlMs = 30_000,
): ServiceTopology {
  const names = serviceQueueNames(service);
  return {
    exchange: EVENT_EXCHANGE,
    queues: [
      { name: names.events, durable: true },
      {
        name: names.retry,
        durable: true,
        arguments: {
          'x-message-ttl': retryTtlMs,
          'x-dead-letter-exchange': EVENT_EXCHANGE,
        },
      },
      { name: names.failed, durable: true },
    ],
    bindings: patterns.map((pattern) => ({ queue: names.events, pattern })),
  };
}

/** En-têtes AMQP d'une enveloppe : identité du message et propagation du traceparent. */
export function amqpHeaders(envelope: EventEnvelope): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'message-id': envelope.id,
    'message-type': envelope.type,
    'message-version': String(envelope.version),
    'x-producer': envelope.producer,
    'x-occurred-at': envelope.occurred_at,
  };
  if (envelope.traceparent !== undefined) headers[AMQP_TRACEPARENT_HEADER] = envelope.traceparent;
  return headers;
}

/** Relit le traceparent d'un message reçu (absent ou invalide ⇒ `undefined`). */
export function traceparentFromHeaders(
  headers: Record<string, unknown> | undefined,
): string | undefined {
  const value = headers?.[AMQP_TRACEPARENT_HEADER];
  if (typeof value !== 'string') return undefined;
  return TRACEPARENT_PATTERN.test(value) ? value : undefined;
}
