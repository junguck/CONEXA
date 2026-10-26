import { fileURLToPath } from 'node:url';

/**
 * Chemins absolus des presets TypeScript livrés par @conexa/config.
 * Un paquet peut donc écrire :
 *
 *   { "extends": "@conexa/config/tsconfig/library.json" }
 */
export const tsconfigDir = fileURLToPath(new URL('../tsconfig', import.meta.url));
export const tsconfigBasePath = `${tsconfigDir}/base.json`;
export const tsconfigLibraryPath = `${tsconfigDir}/library.json`;
