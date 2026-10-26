import { eventEnvelopeSchema, type EventEnvelope } from './envelope.js';
import { assertNoPii } from './pii.js';

/**
 * Valide une enveloppe reçue : structure d'abord, garde-fou PII ensuite.
 * Lève une `ZodError` (structure) ou une `EventPiiError` (donnée interdite).
 */
export function parseEvent(input: unknown): EventEnvelope {
  const envelope = eventEnvelopeSchema.parse(input);
  assertNoPii(envelope.payload);
  return envelope;
}
