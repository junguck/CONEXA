import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Le test d'intégration charge NestJS et ouvre PostgreSQL à la demande.
    hookTimeout: 30_000,
    // Les tests d'intégration partagent une base PostgreSQL : les fichiers
    // s'exécutent l'un après l'autre pour qu'aucun ne nettoie les lignes d'un autre.
    fileParallelism: false,
  },
});
