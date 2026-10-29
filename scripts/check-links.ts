/**
 * Build-time link check (PF-44): internal links, assets, anchors, our link policy and own-origin URLs in
 * a built site. Usage: `tsx scripts/check-links.ts [dir]` (default dist; fixtures: dist-fixtures).
 * Runs as part of `pnpm build` and `pnpm build:fixtures`. External reachability is lychee's job (links.yml).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { checkSite } from '../src/lib/link-check';

const ROOT = new URL('..', import.meta.url).pathname;
const dir = join(ROOT, process.argv[2] ?? 'dist');

function* walk(d: string): Generator<string> {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const files = new Set<string>();
const html = new Map<string, string>();
const xml = new Map<string, string>();
for (const f of walk(dir)) {
  const rel = relative(dir, f).split('\\').join('/');
  files.add(rel);
  if (rel.endsWith('.html')) html.set(rel, readFileSync(f, 'utf8'));
  else if (/^sitemap.*\.xml$/.test(rel)) xml.set(rel, readFileSync(f, 'utf8'));
}

const issues = checkSite({
  files,
  html,
  xml,
  origin: process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321',
});
if (issues.length) {
  console.error(`✖ link check failed (${issues.length}) in ${relative(ROOT, dir)}:`);
  for (const i of issues) console.error(`  [${i.kind}] ${i.page}: ${i.detail}`);
  process.exit(1);
}
console.log(`✓ link check passed (${html.size} pages, ${files.size} files)`);
