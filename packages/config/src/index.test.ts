import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { tsconfigBasePath, tsconfigLibraryPath } from './index.js';

type Preset = { extends?: string; compilerOptions?: Record<string, unknown> };

function readPreset(path: string): Preset {
  return JSON.parse(readFileSync(path, 'utf8')) as Preset;
}

describe('presets TypeScript partagés', () => {
  it('expose le preset de base en mode strict', () => {
    const preset = readPreset(tsconfigBasePath);

    expect(preset.compilerOptions?.strict).toBe(true);
  });

  it('fait hériter le preset de bibliothèque du preset de base', () => {
    const preset = readPreset(tsconfigLibraryPath);

    expect(preset.extends).toBe('./base.json');
    expect(preset.compilerOptions).toBeTypeOf('object');
  });
});
