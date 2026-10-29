// Live smoke runner: runs only the @smoke Playwright tests against an already-deployed site.
// Usage: SMOKE_BASE_URL=https://shadman-portfolio.web.app pnpm smoke:live
// With SMOKE_BASE_URL unset it prints a notice and exits 0, so it is safe in any pipeline by default.
import { spawnSync } from 'node:child_process';

const raw = process.env.SMOKE_BASE_URL?.trim();
if (!raw) {
  console.log('smoke:live skipped: set SMOKE_BASE_URL to the deployed origin to run it.');
  process.exit(0);
}

let origin;
try {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('not http(s)');
  origin = url.origin;
} catch {
  console.error(`smoke:live: SMOKE_BASE_URL is not a valid http(s) URL: ${raw}`);
  process.exit(2);
}

// Default to chromium; SMOKE_PROJECT may name any project from playwright.config.ts (e.g. webkit).
const project = process.env.SMOKE_PROJECT?.trim() || 'chromium';
console.log(`smoke:live: @smoke on ${origin} (${project})`);
const res = spawnSync('pnpm', ['exec', 'playwright', 'test', `--project=${project}`, '--grep', '@smoke'], {
  stdio: 'inherit',
  env: { ...process.env, BASE_URL: origin },
});
process.exit(res.status ?? 1);
