// The three e2e passes CI runs, defined once so CI, `pnpm e2e:docker` and `pnpm verify` cannot drift.
//   node scripts/e2e-passes.mjs [real|shipped|fixtures|all]
// E2E_PROJECTS=chromium,mobile limits the "real" and "fixtures" passes to those Playwright projects
// (for machines that cannot run every browser; CI never sets it).
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** @type {Record<string, { title: string; args: string[]; env: Record<string, string>; projectsApply: boolean }>} */
export const PASSES = {
  real: {
    title: 'real content, drafts included, every project',
    args: ['exec', 'playwright', 'test'],
    env: { CI: 'true', PUBLIC_INCLUDE_DRAFTS: 'true', PUBLIC_CONTENT_FIXTURES: 'false' },
    projectsApply: true,
  },
  // What ships has no drafts: smoke + axe must pass on that build too.
  shipped: {
    title: 'shipped build (no drafts), @smoke and axe on chromium',
    args: ['exec', 'playwright', 'test', '--project=chromium', '--grep', '@smoke|axe'],
    env: { CI: 'true', PUBLIC_INCLUDE_DRAFTS: 'false', PUBLIC_CONTENT_FIXTURES: 'false', E2E_PORT: '5050' },
    projectsApply: false,
  },
  // Fictional, fully populated content (tests/fixtures/content) on its own build and port.
  fixtures: {
    title: '@fixtures suite',
    args: ['run', 'e2e:fixtures'],
    env: { CI: 'true', E2E_FIXTURES_PORT: '5390' },
    projectsApply: true,
  },
};

export const PASS_NAMES = Object.keys(PASSES);

/** @param {string} name @param {string | undefined} projects comma separated Playwright project names */
export function passCommand(name, projects) {
  const pass = PASSES[name];
  if (!pass) throw new Error(`unknown pass "${name}" (use ${PASS_NAMES.join(', ')} or all)`);
  const list = (projects ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const extra = pass.projectsApply ? list.map((p) => `--project=${p}`) : [];
  // `pnpm run e2e:fixtures --project=x` forwards extra args to the script.
  return { cmd: 'pnpm', args: [...pass.args, ...extra], env: pass.env, title: pass.title };
}

/** @param {string} which */
export function selectPasses(which) {
  if (which === 'all') return PASS_NAMES;
  if (!PASSES[which]) throw new Error(`unknown pass "${which}" (use ${PASS_NAMES.join(', ')} or all)`);
  return [which];
}

function main() {
  const which = process.argv[2] ?? 'all';
  let names;
  try {
    names = selectPasses(which);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  }
  let failed = false;
  for (const name of names) {
    const { cmd, args, env, title } = passCommand(name, process.env.E2E_PROJECTS);
    console.log(`\n== e2e pass "${name}": ${title} ==`);
    const res = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    if (res.status !== 0) {
      failed = true;
      console.error(`e2e pass "${name}" failed`);
      break;
    }
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
