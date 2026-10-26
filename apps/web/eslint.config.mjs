import base from '@conexa/config/eslint/base';

export default [
  ...base,
  {
    ignores: ['public/sw.js', 'public/sw.js.map', '.next/**', 'next-env.d.ts'],
  },
  {
    files: ['scripts/**/*.mjs', '*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: { 'no-console': 'off' },
  },
];
