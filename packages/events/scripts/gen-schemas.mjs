// Génère les JSON Schema versionnés des événements depuis le paquet compilé.
// Usage : pnpm --filter @conexa/events gen:contracts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const { eventEnvelopeSchema } = await import('../dist/common/envelope.js');

const outputDir = join(import.meta.dirname, '..', 'src', 'common', 'schemas');
mkdirSync(outputDir, { recursive: true });

const envelope = z.toJSONSchema(eventEnvelopeSchema, { target: 'draft-2020-12' });
writeFileSync(
  join(outputDir, 'envelope.v1.json'),
  `${JSON.stringify(envelope, null, 2)}\n`,
  'utf8',
);
