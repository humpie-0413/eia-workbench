// eslint.config.mjs — ESLint 9 flat config.
// Preserves the intent of the legacy .eslintrc.cjs:
//   - eslint:recommended
//   - @typescript-eslint recommended + no-explicit-any (CLAUDE.md §5 hard rule)
//   - consistent-type-imports
//   - eslint-plugin-astro flat/recommended (Astro files parsed by astro-eslint-parser,
//     <script> blocks parsed by @typescript-eslint/parser)
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import astro from 'eslint-plugin-astro';
import astroParser from 'astro-eslint-parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Ambient declaration files: TS resolves globals (D1Database, R2Bucket, etc.)
    // via triple-slash references, so ESLint's no-undef produces false positives.
    files: ['**/*.d.ts'],
    rules: {
      'no-undef': 'off',
    },
  },
  ...astro.configs['flat/recommended'],
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.astro'],
      },
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.astro/**',
      '.wrangler/**',
      '.vscode/**',
    ],
  },
];
