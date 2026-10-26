import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

/**
 * Lit `src/features/<domaine>/nav.ts` et renvoie les entrées de navigation.
 * Chaque fichier exporte par défaut un objet :
 *   { label: string, href: string, order?: number, group?: string }
 * Un fichier invalide fait échouer la génération : mieux vaut un build rouge
 * qu'une navigation silencieusement incomplète.
 */
export async function collectFeatureNav(featuresDir) {
  const entries = await readdir(featuresDir, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });

  const navEntries = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(featuresDir, entry.name, 'nav.ts');
    let source;
    try {
      source = await readFile(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }

    const transpiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: file,
    }).outputText;

    const module = await import(
      `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
    );
    const nav = module.default ?? module.nav;
    if (!nav || typeof nav !== 'object') {
      throw new Error(`${file} doit exporter un objet de navigation (export default).`);
    }
    if (typeof nav.label !== 'string' || nav.label.trim() === '') {
      throw new Error(`${file} : « label » est obligatoire.`);
    }
    if (typeof nav.href !== 'string' || !nav.href.startsWith('/')) {
      throw new Error(`${file} : « href » doit commencer par « / ».`);
    }

    navEntries.push({
      id: entry.name,
      label: nav.label,
      href: nav.href,
      order: Number.isFinite(nav.order) ? nav.order : 100,
    });
  }

  return navEntries.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'fr'));
}

/** Rend le fichier TypeScript généré (déterministe : même entrée, même sortie). */
export function renderRegistry(navEntries) {
  const items = navEntries
    .map(
      (item) =>
        `  { id: ${JSON.stringify(item.id)}, label: ${JSON.stringify(item.label)}, href: ${JSON.stringify(
          item.href,
        )} },`,
    )
    .join('\n');

  return `// Généré par \`pnpm --filter @conexa/backoffice gen:registry\` depuis src/features/*/nav.ts.
// Ne pas modifier à la main : ajoutez un fichier de navigation dans votre domaine,
// puis relancez la commande.
export interface FeatureNavEntry {
  id: string;
  label: string;
  href: string;
}

export const featureNav: FeatureNavEntry[] = [
${items}
];
`;
}
