#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectFeatureNav, renderRegistry } from './registry.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const featuresDir = path.join(appRoot, 'src', 'features');
const outputFile = path.join(appRoot, 'src', 'shell', 'nav.generated.ts');

const entries = await collectFeatureNav(featuresDir);
await writeFile(outputFile, renderRegistry(entries), 'utf8');
console.log(`Navigation : ${entries.length} entrée(s) générée(s) dans src/shell/nav.generated.ts`);
