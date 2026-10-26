import { openApiComponents } from './common/openapi.js';
import { errorEnvelopeSchema } from './common/error.js';
import { cursorQuerySchema } from './common/pagination.js';
import {
  amountFcfaSchema,
  dateOnlySchema,
  isoDateTimeSchema,
  uuidSchema,
} from './common/primitives.js';

/**
 * Document OpenAPI 3.1 des composants communs.
 * Généré par `pnpm --filter @conexa/contracts gen:contracts` ; le test
 * `contracts.test.ts` échoue si le fichier committé n'est plus à jour.
 */
export function buildCommonOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Convexa — composants communs',
      version: '1.0.0',
      description:
        'Composants partagés (enveloppe d’erreur, pagination, primitives) générés depuis @conexa/contracts. Ne pas éditer à la main.',
    },
    components: {
      schemas: openApiComponents({
        ErrorEnvelope: errorEnvelopeSchema,
        CursorQuery: cursorQuerySchema,
        Uuid: uuidSchema,
        IsoDateTime: isoDateTimeSchema,
        DateOnly: dateOnlySchema,
        AmountFcfa: amountFcfaSchema,
      }),
    },
  };
}
