import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectFeatureNav, renderRegistry } from './registry.mjs';

async function fixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), 'cxa-registry-'));
  for (const [name, source] of Object.entries(files)) {
    await mkdir(path.join(root, name), { recursive: true });
    await writeFile(path.join(root, name, 'nav.ts'), source, 'utf8');
  }
  return root;
}

describe('collectFeatureNav', () => {
  it('lit chaque dossier, trie par ordre et complète l’univers', async () => {
    const root = await fixture({
      football: "export default { label: 'Foot', href: '/football', universe: 'foot', order: 1 };",
      talents: "export default { label: 'Pro', href: '/pro' };",
    });

    const entries = await collectFeatureNav(root);
    expect(entries).toEqual([
      { id: 'football', label: 'Foot', href: '/football', universe: 'foot', order: 1 },
      { id: 'talents', label: 'Pro', href: '/pro', universe: 'core', order: 100 },
    ]);
  });

  it('ignore un dossier sans nav.ts et accepte un dossier absent', async () => {
    const root = await fixture({ empty: 'export const other = 1;' });
    await expect(collectFeatureNav(root)).rejects.toThrow(/export default/);
    await expect(collectFeatureNav(path.join(root, 'missing'))).resolves.toEqual([]);
  });

  it('refuse un href qui n’est pas une route absolue', async () => {
    const root = await fixture({ bad: "export default { label: 'Bad', href: 'football' };" });
    await expect(collectFeatureNav(root)).rejects.toThrow(/href/);
  });
});

describe('renderRegistry', () => {
  it('produit un fichier déterministe et typé', () => {
    const output = renderRegistry([
      { id: 'demo', label: 'Démo', href: '/demo', universe: 'core', order: 10 },
    ]);
    expect(output).toContain('export const featureNav: FeatureNavEntry[] = [');
    expect(output).toContain('{ id: "demo", label: "Démo", href: "/demo", universe: "core" },');
    expect(renderRegistry([])).toContain('export const featureNav: FeatureNavEntry[] = [\n\n];');
  });
});
