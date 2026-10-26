export {
  buildEvent,
  eventEnvelopeSchema,
  eventTypeSchema,
  producerSchema,
} from './common/envelope.js';
export type { BuildEventInput, EventEnvelope } from './common/envelope.js';
export { traceparentSchema } from './common/envelope.js';
export {
  EventPiiError,
  FORBIDDEN_PAYLOAD_KEYS,
  assertNoPii,
  findForbiddenKeys,
} from './common/pii.js';
export { parseEvent } from './common/validate.js';
