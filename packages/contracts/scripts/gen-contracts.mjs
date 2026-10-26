// Génère packages/contracts/openapi/common.json depuis le paquet compilé.
// Usage : pnpm --filter @conexa/contracts gen:contracts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const { buildCommonOpenApiDocument } = await import('../dist/index.js');

const outputPath = join(import.meta.dirname, '..', 'openapi', 'common.json');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(buildCommonOpenApiDocument(), null, 2)}\n`, 'utf8');
