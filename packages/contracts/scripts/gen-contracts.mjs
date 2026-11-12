// Génère packages/contracts/openapi/*.json depuis le paquet compilé.
// Usage : pnpm --filter @conexa/contracts gen:contracts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const { buildCommonOpenApiDocument } = await import('../dist/index.js');
const { buildDatingOpenApiDocument } = await import('../dist/dating/openapi.js');

// Un fichier par domaine publié : le format ne dépend pas de l'ordre des tâches.
const documents = {
  'common.json': buildCommonOpenApiDocument(),
  'dating.json': buildDatingOpenApiDocument(),
};

for (const [name, document] of Object.entries(documents)) {
  const outputPath = join(import.meta.dirname, '..', 'openapi', name);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}
