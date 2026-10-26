import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/** `user.approved`, `payment.escrowed`, `service_order.requested` … */
export const eventTypeSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/,
    'format attendu : domaine.action (minuscules, séparés par un point)',
  );

/** Service producteur : un seul producteur par événement (ADR 0004). */
export const producerSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]+$/, 'nom de service en minuscules (ex. identity, ai-worker)');

/** En-tête W3C propagé du Gateway jusqu'au consommateur. */
export const traceparentSchema = z
  .string()
  .regex(/^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/, 'traceparent W3C attendu');

/**
 * Enveloppe d'événement — voir ADR 0004.
 *
 * `version` est la version du schéma de `payload` : une rupture produit `v2`
 * (nouveau fichier JSON Schema), jamais une modification sur place.
 */
export const eventEnvelopeSchema = z.object({
  id: z.uuid(),
  type: eventTypeSchema,
  version: z.int().min(1),
  occurred_at: z.iso.datetime(),
  producer: producerSchema,
  traceparent: traceparentSchema.optional(),
  payload: z.record(z.string(), z.unknown()),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

export interface BuildEventInput {
  type: string;
  producer: string;
  payload: Record<string, unknown>;
  version?: number;
  traceparent?: string;
  id?: string;
  occurredAt?: Date | string;
}

/** Construit une enveloppe valide : identifiant UUID et horodatage par défaut. */
export function buildEvent(input: BuildEventInput): EventEnvelope {
  const occurredAt = input.occurredAt;
  const envelope: EventEnvelope = {
    id: input.id ?? randomUUID(),
    type: input.type,
    version: input.version ?? 1,
    occurred_at:
      occurredAt === undefined
        ? new Date().toISOString()
        : typeof occurredAt === 'string'
          ? occurredAt
          : occurredAt.toISOString(),
    producer: input.producer,
    payload: input.payload,
  };
  if (input.traceparent !== undefined) envelope.traceparent = input.traceparent;
  return eventEnvelopeSchema.parse(envelope);
}
