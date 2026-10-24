// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

const site = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';

// Drafts are for dev/e2e only. An indexable (production) build must never include them.
if (process.env.PUBLIC_INCLUDE_DRAFTS === 'true' && process.env.PUBLIC_INDEXABLE === 'true') {
  throw new Error('Refusing to build: PUBLIC_INCLUDE_DRAFTS=true with PUBLIC_INDEXABLE=true');
}

export default defineConfig({
  site,
  output: 'static',
  // Pairs with firebase.json `cleanUrls: true` + `trailingSlash: false`:
  // /about is served from about.html, no redirect loops.
  trailingSlash: 'never',
  build: { format: 'file' },
  // CSP is `script-src 'self'` (firebase.json): Astro must never inline page scripts into the HTML.
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [mdx(), sitemap({ filter: (page) => !page.endsWith('/404') })],
});
