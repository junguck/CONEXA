import { buildEvent, eventEnvelopeSchema } from './common/envelope.js';

export {
  buildEvent,
  eventEnvelopeSchema,
  eventTypeSchema,
  producerSchema,
  traceparentSchema,
} from './common/envelope.js';
export type { BuildEventInput, EventEnvelope } from './common/envelope.js';
export {
  EventPiiError,
  FORBIDDEN_PAYLOAD_KEYS,
  assertNoPii,
  findForbiddenKeys,
} from './common/pii.js';
export { parseEvent } from './common/validate.js';
export type { EventHandler, EventPublisher } from './common/publisher.js';
export { InMemoryEventBus } from './common/memory-bus.js';

/*
 * Alias v1 (ADR 0007) : la piste v1 importe `EventEnvelopeSchema` et
 * `createEvent` dans six fichiers. Les conserver évite de les réécrire et
 * garantit une seule enveloppe d'événement pour tout le dépôt.
 */

/** Alias v1 du schéma d'enveloppe. */
export const EventEnvelopeSchema = eventEnvelopeSchema;

/** Alias v1 de `buildEvent` (mêmes entrées, champs supplémentaires optionnels). */
export const createEvent = buildEvent;
