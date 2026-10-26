import { z } from 'zod';

import { EventEnvelopeSchema } from '../index.js';

export const IDENTITY_EVENTS = {
  userRegistered: 'identity.user.registered.v1',
  userApproved: 'identity.user.approved.v1',
  userSuspended: 'identity.user.suspended.v1',
} as const;

/** Aucune PII : identifiant, filière et niveau seulement (ADR 0003). */
export const UserRegisteredPayloadSchema = z.object({
  user_id: z.uuid(),
  filiere_id: z.number().int(),
  study_level: z.number().int(),
});

export const UserApprovedPayloadSchema = z.object({ user_id: z.uuid() });
export const UserSuspendedPayloadSchema = z.object({
  user_id: z.uuid(),
  status: z.enum(['suspended', 'banned']),
});

/** Enveloppe complète, prête à être publiée dans l'outbox. */
export const userRegisteredEnvelope = EventEnvelopeSchema.extend({
  type: z.literal(IDENTITY_EVENTS.userRegistered),
  payload: UserRegisteredPayloadSchema,
});
