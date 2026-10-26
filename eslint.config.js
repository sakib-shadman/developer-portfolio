import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/',
      'dist-fixtures/',
      '.astro/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'Claude outputs/',
      '.secrets/',
      '.review/',
      'pw.local.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  ...astro.configs['jsx-a11y-strict'],
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    // role="list" on styled lists is intentional: Safari/VoiceOver drops list semantics with list-style:none.
    rules: { 'astro/jsx-a11y/no-redundant-roles': ['error', { ul: ['list'], ol: ['list'] }] },
  },
  {
    // ADR-0008: data access only through src/lib/content/*
    files: ['src/components/**', 'src/pages/**', 'src/layouts/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'astro:content', message: 'Import data via src/lib/content/* (ADR-0008).' }] },
      ],
    },
  },
];
