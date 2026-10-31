// "Ready for PR" gate: what CI's quality job runs, then the e2e passes.
//   pnpm verify [--skip-e2e] [--no-docker]
// e2e runs in the CI Playwright container when Docker is available (same fonts, browsers and OS as CI).
// Without Docker it falls back to local Playwright and says loudly that the run does not match CI.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { dockerAvailable, runInDocker } from './e2e-docker.mjs';

/**
 * The quality steps are NOT listed here: they are read from the `quality` job of .github/workflows/ci.yml,
 * so that file is the single, visible source of truth for what CI checks (a PR that drops lint or test must
 * show up as a ci.yml diff). Needs no dependencies, because it runs before `pnpm install`.
 * Supported shape (guarded by tests/unit/ci-parity.test.ts against a real YAML parse): `- run: <command>`
 * steps, each optionally followed by an `env:` block of `KEY: 'value'` lines.
 * @param {string} ciYaml
 * @returns {{ command: string; env: Record<string, string> }[]}
 */
export function qualitySteps(ciYaml) {
  const lines = ciYaml.split('\n');
  const start = lines.findIndex((l) => /^ {2}quality:\s*$/.test(l));
  if (start === -1) throw new Error('no `quality` job in ci.yml');
  /** @type {{ command: string; env: Record<string, string> }[]} */
  const steps = [];
  let inEnv = false;
  for (const line of lines.slice(start + 1)) {
    if (/^ {2}\S/.test(line)) break; // next job
    const run = /^ {6}- run: (.+?)\s*$/.exec(line);
    if (run) {
      steps.push({ command: run[1], env: {} });
      inEnv = false;
    } else if (/^ {6}- /.test(line)) {
      inEnv = false; // a `uses:` step
    } else if (/^ {8}env:\s*$/.test(line)) {
      inEnv = steps.length > 0;
    } else if (inEnv) {
      const kv = /^ {10}(\w+): '?([^']*)'?\s*$/.exec(line);
      if (kv) steps.at(-1).env[kv[1]] = kv[2];
    }
  }
  if (steps.length === 0) throw new Error('the `quality` job in ci.yml has no `run:` steps');
  return steps;
}

/**
 * Local-only tweak (ci.yml stays untouched and is still the source of truth for the step text).
 * Without a TTY, `pnpm install` aborts with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY whenever it wants to
 * purge an existing node_modules (installed from another store path, pnpm version or layout) and would have
 * to ask first. CI never hits this (fresh checkout, and CI=true skips the prompt). We run the install with
 * `--config.confirmModulesPurge=false` so it purges and reinstalls without asking: that is what the
 * frozen-lockfile install would do after a "yes" anyway. pnpm documents the setting at
 * https://pnpm.io/settings#confirmmodulespurge (the error text suggests CI=true or this setting).
 * Only `pnpm install` steps are touched, and a command that already sets the option is left alone.
 * @param {string} command
 * @returns {string}
 */
export function nonInteractive(command) {
  if (!/^pnpm install(\s|$)/.test(command) || command.includes('confirmModulesPurge')) return command;
  return `${command} --config.confirmModulesPurge=false`;
}

function sh(command, env = {}) {
  console.log(`\n$ ${command}`);
  return spawnSync(command, { shell: true, stdio: 'inherit', env: { ...process.env, ...env } }).status === 0;
}

function main() {
  const flags = new Set(process.argv.slice(2));
  for (const step of qualitySteps(readFileSync('.github/workflows/ci.yml', 'utf8'))) {
    if (!sh(nonInteractive(step.command), step.env)) {
      console.error(`\nverify FAILED at: ${step.command}`);
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
