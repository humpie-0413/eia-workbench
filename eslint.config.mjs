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
import globals from 'globals';

// Cloudflare Workers ambient types not covered by globals.browser or globals.node.
const cfWorkersGlobals = {
  D1Database: 'readonly',
  R2Bucket: 'readonly',
  R2Object: 'readonly',
  ExecutionContext: 'readonly',
  ScheduledController: 'readonly',
  Env: 'readonly',
  KVNamespace: 'readonly',
  DurableObject: 'readonly',
};

export default [
  js.configs.recommended,
  // Source and worker files: browser + node + Cloudflare Workers globals.
  {
    files: ['src/**/*.{ts,tsx,astro}', 'workers/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...cfWorkersGlobals,
      },
    },
  },
  // Test files: browser + node + minimal CF globals used in test helpers.
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...cfWorkersGlobals,
      },
    },
  },
  // Root config files (playwright.config.ts, vitest.config.ts, etc.) need node globals.
  {
    files: ['*.ts', '*.mjs', '*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
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
      // Allow intentionally-unused parameters prefixed with _.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // TypeScript's own checker handles undefined-variable errors for .ts/.tsx files;
      // ESLint's no-undef produces false positives for ambient types (App, RequestInit, etc.).
      'no-undef': 'off',
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
