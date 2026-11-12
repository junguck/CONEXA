import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { buildDatingOpenApiDocument } from './openapi.js';

/**
 * Le document OpenAPI dating est publié (committé) : ce test échoue dès qu'un
 * schéma Zod change sans que `pnpm --filter @conexa/contracts gen:contracts`
 * soit relancé.
 */
describe('OpenAPI dating publié', () => {
  it('garde le document committé synchronisé avec les schémas', () => {
    const committed = JSON.parse(
      readFileSync(new URL('../../openapi/dating.json', import.meta.url), 'utf8'),
    );
    expect(buildDatingOpenApiDocument()).toEqual(committed);
  });

  it('ne référence le schéma Contact que dans sa route dédiée', () => {
    const document = buildDatingOpenApiDocument();
    const paths = document.paths as Record<string, unknown>;
    const referencing = Object.entries(paths)
      .filter(([, entry]) => JSON.stringify(entry).includes('#/components/schemas/Contact'))
      .map(([path]) => path);
    expect(referencing).toEqual(['/dates/{id}/contact']);
    // Aucun numéro décrit ailleurs : le contact n'a qu'une forme, dédiée.
    expect(JSON.stringify(paths)).not.toContain('whatsapp');
  });

  it('publie les routes qui ont changé le 12/11', () => {
    const paths = buildDatingOpenApiDocument().paths as Record<string, unknown>;
    expect(Object.keys(paths)).toContain('/dates/{id}/slot');
    expect(Object.keys(paths)).toContain('/dates/{id}/contact');
    expect(Object.keys(paths)).not.toContain('/me/credits');
  });
});
