import type { EventEnvelope } from './envelope.js';

/**
 * Port de publication sur le bus (échange topic RabbitMQ en production).
 *
 * **Par lot** : c'est la sémantique de l'outbox (un lot = une publication, un
 * accusé, une reprise) et cela évite d'ouvrir un canal par événement.
 * Le port reste **strictement par lot** : un lot = une publication, un accusé,
 * une reprise. Les producteurs de la piste v1 publient donc `publish([event])`
 * (voir `v1-compat.test.ts`) ; seul le bus en mémoire tolère l'appel unitaire.
 *
 * Toute implémentation doit être au moins une fois : un doublon est possible,
 * jamais une perte — les consommateurs restent idempotents (`consumeIdempotent`).
 */
export interface EventPublisher {
  publish(envelopes: EventEnvelope[]): Promise<void>;
}

/** Abonné d'un type d'événement ; il doit rester idempotent. */
export type EventHandler = (event: EventEnvelope) => Promise<void> | void;
