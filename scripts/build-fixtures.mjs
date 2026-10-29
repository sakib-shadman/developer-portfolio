// Builds the site from tests/fixtures/content into dist-fixtures/ (issue #17), leaving dist/ alone so
// the real-content and fixture e2e suites never share build output. Refused with PUBLIC_INDEXABLE=true
// by astro.config.mjs. Used by playwright.fixtures.config.ts and CI.
import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  PUBLIC_CONTENT_FIXTURES: 'true',
  PUBLIC_INCLUDE_DRAFTS: 'false',
  PUBLIC_INDEXABLE: 'false',
};
for (const args of [
  ['content:check'],
  ['exec', 'astro', 'build', '--outDir', 'dist-fixtures'],
  ['exec', 'tsx', 'scripts/check-links.ts', 'dist-fixtures'],
]) {
  const r = spawnSync('pnpm', args, { stdio: 'inherit', env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
