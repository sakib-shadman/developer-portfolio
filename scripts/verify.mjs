// "Ready for PR" gate: what CI's quality job runs, then the e2e passes.
//   pnpm verify [--skip-e2e] [--no-docker]
// e2e runs in the CI Playwright container when Docker is available (same fonts, browsers and OS as CI).
// Without Docker it falls back to local Playwright and says loudly that the run does not match CI.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { dockerAvailable, runInDocker } from './e2e-docker.mjs';

/** Must stay equal to the `quality` job's run steps in .github/workflows/ci.yml (guarded by a unit test). */
export const QUALITY_STEPS = [
  'pnpm install --frozen-lockfile',
  'pnpm lint',
  'pnpm typecheck',
  'pnpm test',
  'pnpm build',
];

/** The env CI gives `pnpm build` in the quality job. */
export const BUILD_ENV = {
  PUBLIC_SITE_URL: 'https://shadman-portfolio.web.app',
  PUBLIC_INDEXABLE: 'false',
  PUBLIC_INCLUDE_DRAFTS: 'false',
  PUBLIC_CONTENT_FIXTURES: 'false',
};

function sh(command, env = {}) {
  console.log(`\n$ ${command}`);
  return spawnSync(command, { shell: true, stdio: 'inherit', env: { ...process.env, ...env } }).status === 0;
}

function main() {
  const flags = new Set(process.argv.slice(2));
  for (const step of QUALITY_STEPS) {
    if (!sh(step, step === 'pnpm build' ? BUILD_ENV : {})) {
      console.error(`\nverify FAILED at: ${step}`);
      process.exit(1);
    }
  }
  if (flags.has('--skip-e2e')) {
    console.log(
      '\nverify: quality steps passed. e2e SKIPPED (--skip-e2e): not a full "ready for PR" result.',
    );
    return;
  }
  if (!flags.has('--no-docker') && dockerAvailable()) {
    console.log('\nverify: running e2e in the CI Playwright container');
    if (runInDocker('all') !== 0) {
      console.error('\nverify FAILED in e2e (container)');
      process.exit(1);
    }
    console.log('\nverify: all passed, e2e ran in the CI container.');
    return;
  }
  console.warn(
    [
      '',
      '!! WARNING: Docker is not available (or --no-docker was given).',
      '!! e2e now runs with local Playwright: this run does NOT match CI. Fonts, and any browser not',
      '!! installed here (webkit, firefox), can differ from CI. CI is the authority for those.',
      '!! Set E2E_PROJECTS=chromium,mobile to limit the browsers if some are not installed.',
      '',
    ].join('\n'),
  );
  if (!sh('node scripts/e2e-passes.mjs all')) {
    console.error('\nverify FAILED in e2e (local Playwright)');
    process.exit(1);
  }
  console.warn('\nverify: passed locally, but NOT CI-equivalent. Rely on CI for webkit, firefox and fonts.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
