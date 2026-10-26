import { z } from 'zod';
import { ERROR_CODES } from '@conexa/errors';

/** Code métier validé contre le catalogue partagé (`@conexa/errors`). */
export const errorCodeSchema = z.enum(ERROR_CODES);

/** Corps d'erreur — `docs/product/API.md` §1 « Format d'erreur ». */
export const errorPayloadSchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
  request_id: z.string().min(1).optional(),
});

/** `{ "error": { ... } }` : forme unique de toute réponse en erreur. */
export const errorEnvelopeSchema = z.object({ error: errorPayloadSchema });

export type ErrorEnvelopePayload = z.infer<typeof errorEnvelopeSchema>;
export type ErrorPayloadShape = z.infer<typeof errorPayloadSchema>;
