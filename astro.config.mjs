// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

const site = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';

export default defineConfig({
  site,
  output: 'static',
  // Pairs with firebase.json `cleanUrls: true` + `trailingSlash: false`:
  // /about is served from about.html, no redirect loops.
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [mdx(), sitemap({ filter: (page) => !page.endsWith('/404') })],
});
