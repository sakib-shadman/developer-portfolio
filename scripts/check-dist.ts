/**
 * Post-build guard (issue #17): a build must never ship fixture content. Fails when any text file in
 * dist/ carries the fixture marker. Runs as part of `pnpm build`; fixture builds go to dist-fixtures/
 * through scripts/build-fixtures.mjs and are not checked here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { distLeaks } from '../src/lib/content/root';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const TEXT = /\.(html|xml|txt|js|css|json|svg|webmanifest)$/;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const files = [...walk(DIST)]
  .filter((f) => TEXT.test(f))
  .map((f) => ({ path: relative(ROOT, f), text: readFileSync(f, 'utf8') }));
const leaks = distLeaks(files);
if (leaks.length) {
  console.error(`✖ dist check failed: fixture content in the build:\n  ${leaks.join('\n  ')}`);
  process.exit(1);
}
console.log('✓ dist check passed (no fixture content)');
