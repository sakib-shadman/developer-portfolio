// Run the e2e passes in the same Playwright image CI uses, with the repo mounted.
//   pnpm e2e:docker [real|shipped|fixtures|all] [--print] [--reset]
//   --print  show the docker command instead of running it
//   --reset  remove the cached node_modules volume first (after a Node or image change)
// The image tag is read from .github/workflows/ci.yml, so local and CI cannot use different images
// (tests/unit/ci-parity.test.ts ties that tag to the @playwright/test version in the lockfile).
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { selectPasses } from './e2e-passes.mjs';

export const VOLUME = 'dev-portfolio-e2e-node-modules';
const IMAGE_RE = /mcr\.microsoft\.com\/playwright:v\d+\.\d+\.\d+-noble/;

/** @param {string} ciYaml */
export function playwrightImage(ciYaml) {
  const m = IMAGE_RE.exec(ciYaml);
  if (!m) throw new Error('no mcr.microsoft.com/playwright:v<version>-noble image in ci.yml');
  return m[0];
}

/**
 * Shell run inside the container. Node must match .nvmrc (the image ships Node 24; the wanted major is
 * installed if it differs), pnpm comes from the packageManager field via corepack, and node_modules lives
 * in a docker volume so Mac binaries on the host never collide with the Linux ones. Files the run writes
 * into the mounted repo are handed back to the host user on Linux (Docker Desktop on macOS does that itself).
 */
export const INNER_SCRIPT = [
  'set -euo pipefail',
  'cleanup() {',
  '  if [ -n "${HOST_UID:-}" ]; then',
  '    chown -R "$HOST_UID:$HOST_GID" dist dist-fixtures .astro test-results playwright-report .firebase-e2e.*.json 2>/dev/null || true',
  '  fi',
  '}',
  'trap cleanup EXIT',
  `want="$(tr -d 'v \\n' < .nvmrc | cut -d. -f1)"`,
  `have="$(node -p 'process.versions.node.split(".")[0]')"`,
  'if [ "$have" != "$want" ]; then',
  '  echo "Node $have in the image, .nvmrc wants $want: installing it"',
  '  npm install -g "node@$want" >/dev/null',
  'fi',
  'export COREPACK_ENABLE_DOWNLOAD_PROMPT=0',
  'corepack enable',
  `corepack prepare "$(node -p 'require("./package.json").packageManager')" --activate`,
  'export npm_config_store_dir=/work/node_modules/.pnpm-store',
  'pnpm install --frozen-lockfile',
  'node scripts/e2e-passes.mjs "$PASS"',
].join('\n');

/**
 * @param {{ image: string; cwd: string; pass: string; platform: string; uid?: number; gid?: number; gitDir: boolean; projects?: string }} o
 */
export function dockerArgs(o) {
  selectPasses(o.pass); // throws on an unknown pass
  const args = ['run', '--rm', '--init', '--ipc=host', '-w', '/work'];
  args.push('-v', `${o.cwd}:/work`, '-v', `${VOLUME}:/work/node_modules`);
  // The container must never rewrite the host's git hooks (`prepare` runs lefthook install).
  if (o.gitDir) args.push('-v', `${o.cwd}/.git:/work/.git:ro`);
  args.push('-e', `PASS=${o.pass}`, '-e', 'E2E_CONTAINER=true', '-e', 'CI=true');
  if (o.projects) args.push('-e', `E2E_PROJECTS=${o.projects}`);
  if (o.platform === 'linux' && o.uid !== undefined && o.gid !== undefined) {
    args.push('-e', `HOST_UID=${o.uid}`, '-e', `HOST_GID=${o.gid}`);
  }
  args.push(o.image, 'bash', '-c', INNER_SCRIPT);
  return args;
}

export function dockerAvailable() {
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Runs the passes in docker; returns the exit status. */
export function runInDocker(pass = 'all', { print = false, reset = false } = {}) {
  const cwd = process.cwd();
  const image = playwrightImage(readFileSync('.github/workflows/ci.yml', 'utf8'));
  const args = dockerArgs({
    image,
    cwd,
    pass,
    platform: process.platform,
    uid: process.getuid?.(),
    gid: process.getgid?.(),
    gitDir: isDir(`${cwd}/.git`),
    projects: process.env.E2E_PROJECTS,
  });
  if (print) {
    console.log(['docker', ...args.slice(0, -1), '<inner script below>'].join(' '));
    console.log(`\n${INNER_SCRIPT}`);
    return 0;
  }
  if (!dockerAvailable()) {
    console.error('e2e:docker needs Docker running (docker info failed). CI is the authority without it.');
    return 2;
  }
  if (reset) spawnSync('docker', ['volume', 'rm', '-f', VOLUME], { stdio: 'inherit' });
  console.log(`e2e:docker: ${image}, pass "${pass}" (first run pulls the image and installs dependencies)`);
  return spawnSync('docker', args, { stdio: 'inherit' }).status ?? 1;
}

function main() {
  const rest = process.argv.slice(2);
  const flags = new Set(rest.filter((a) => a.startsWith('--')));
  const pass = rest.find((a) => !a.startsWith('--')) ?? 'all';
  try {
    process.exit(runInDocker(pass, { print: flags.has('--print'), reset: flags.has('--reset') }));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
