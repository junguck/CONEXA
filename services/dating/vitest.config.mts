import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Le test d'intégration charge NestJS et ouvre PostgreSQL à la demande.
    hookTimeout: 30_000,
  },
});
