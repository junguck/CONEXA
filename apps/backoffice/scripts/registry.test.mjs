import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectFeatureNav, renderRegistry } from './registry.mjs';

async function fixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), 'cxa-bo-registry-'));
  for (const [name, source] of Object.entries(files)) {
    await mkdir(path.join(root, name), { recursive: true });
    await writeFile(path.join(root, name, 'nav.ts'), source, 'utf8');
  }
  return root;
}

describe('collectFeatureNav', () => {
  it('trie les domaines par ordre puis par libellé', async () => {
    const root = await fixture({
      finance: "export default { label: 'Finance', href: '/finance', order: 2 };",
      accounts: "export default { label: 'Comptes', href: '/comptes', order: 1 };",
    });

    expect(await collectFeatureNav(root)).toEqual([
      { id: 'accounts', label: 'Comptes', href: '/comptes', order: 1 },
      { id: 'finance', label: 'Finance', href: '/finance', order: 2 },
    ]);
  });

  it('refuse une fiche sans libellé ou avec un chemin relatif', async () => {
    const missing = await fixture({ bad: "export default { href: '/x' };" });
    await expect(collectFeatureNav(missing)).rejects.toThrow(/label/);

    const relative = await fixture({ bad: "export default { label: 'X', href: 'x' };" });
    await expect(collectFeatureNav(relative)).rejects.toThrow(/href/);
  });

  it('accepte une app sans domaine', async () => {
    await expect(collectFeatureNav('/chemin/inexistant')).resolves.toEqual([]);
  });
});

describe('renderRegistry', () => {
  it('produit un fichier typé et déterministe', () => {
    const output = renderRegistry([{ id: 'demo', label: 'Démo', href: '/demo', order: 1 }]);
    expect(output).toContain('export const featureNav: FeatureNavEntry[] = [');
    expect(output).toContain('{ id: "demo", label: "Démo", href: "/demo" },');
    expect(renderRegistry([])).toContain('export const featureNav: FeatureNavEntry[] = [\n\n];');
  });
});
