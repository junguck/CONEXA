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
      // Désactivé : emitDecoratorMetadata (NestJS) exige des imports de valeur
      // pour les types injectés. Les paquets ESM sont protégés par verbatimModuleSyntax.
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Scripts Node (outils, builds) : globals minimaux sans dépendance au paquet `globals`.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
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
