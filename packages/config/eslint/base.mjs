import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Configuration ESLint (flat config) partagée par tous les paquets du monorepo.
 * Un paquet l'utilise ainsi :
 *
 *   // eslint.config.mjs
 *   export { default } from '@conexa/config/eslint/base';
 *
 * Les règles de formatage ne sont pas ici : c'est Prettier qui les applique.
 */
export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**', '**/.turbo/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Fichiers CommonJS (commitlint, scripts) : globals Node sans dépendance
    // supplémentaire au paquet `globals`.
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        exports: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
