// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { invalidVerificationVars } from './src/lib/seo/verification.ts';
import { isSitemapPage } from './src/lib/seo/sitemap.ts';
import { buildFlagError, fixturesOn, FIXTURE_PUBLIC } from './src/lib/content/root.ts';

const site = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';

// Drafts and test fixtures are for dev/e2e only. An indexable (production) build must never include them.
const flagError = buildFlagError(process.env);
if (flagError) throw new Error(flagError);

// A set-but-malformed ownership token renders no meta tag; say so instead of failing silently.
for (const name of invalidVerificationVars(process.env))
  console.warn(
    `[seo] ${name} is set but is not a valid token (8-128 letters, digits, _ or -); no verification meta tag will be rendered.`,
  );

// Fixture builds also ship the fixture resume PDF. Copying into dist (instead of switching `publicDir`)
// keeps the real public/ assets (favicon, ...) in the build and never puts fixture files in public/.
/** @type {import('astro').AstroIntegration} */
const fixturePublic = {
  name: 'fixture-public',
  hooks: {
    'astro:build:done': ({ dir }) => cpSync(FIXTURE_PUBLIC, fileURLToPath(dir), { recursive: true }),
  },
};

export default defineConfig({
  site,
  output: 'static',
  // Pairs with firebase.json `cleanUrls: true` + `trailingSlash: false`:
  // /about is served from about.html, no redirect loops.
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'always' },
  // CSP is `script-src 'self'` (firebase.json): Astro must never inline page scripts into the HTML.
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [
    mdx(),
    sitemap({ filter: isSitemapPage }),
    ...(fixturesOn(process.env.PUBLIC_CONTENT_FIXTURES) ? [fixturePublic] : []),
  ],
});
