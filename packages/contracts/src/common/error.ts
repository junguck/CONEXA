import { z } from 'zod';
import { ERROR_CODES, ERROR_HTTP_STATUS, httpStatusFor, type ErrorCode } from '@conexa/errors';

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

/*
 * Alias v1 (ADR 0007) : les services de la piste v1 et `service-kit` importent
 * ces noms depuis `@conexa/contracts`. Les conserver évite de réécrire 220
 * lignes d'import au rebase.
 */

/** Table code métier → HTTP (v1). */
export const ERROR_STATUS = ERROR_HTTP_STATUS;

/** Fonction équivalente à `httpStatusFor` (v1). */
export const errorStatus = httpStatusFor;

/** Alias v1 du schéma de code. */
export const ErrorCodeSchema = errorCodeSchema;

/**
 * Alias v1 de `errorEnvelopeSchema`. v1 exigeait `request_id` ; le canonique
 * le laisse optionnel et c'est le Gateway qui le remplit. On accepte donc un
 * sur-ensemble : aucun message v1 valide ne devient invalide.
 */
export const ApiErrorSchema = errorEnvelopeSchema;
export type ApiError = ErrorEnvelopePayload;

export type { ErrorCode };
