import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { dockerArgs, INNER_SCRIPT, playwrightImage, volumeName } from '../../scripts/e2e-docker.mjs';
import { PASS_NAMES, PASSES, passCommand, selectPasses } from '../../scripts/e2e-passes.mjs';
import { nonInteractive, qualitySteps, stepsToRun } from '../../scripts/verify.mjs';

const read = (p: string) => readFileSync(p, 'utf8');
const ciText = read('.github/workflows/ci.yml');
const ci = parse(ciText) as {
  jobs: Record<
    string,
    {
      container?: { image: string; options?: string };
      steps: { run?: string; env?: Record<string, string> }[];
    }
  >;
};
const lock = read('pnpm-lock.yaml');
const lockVersion = /^ {2}'@playwright\/test@(\d+\.\d+\.\d+)':/m.exec(lock)?.[1];

describe('Playwright image and @playwright/test stay in lockstep', () => {
  it('finds the version in the lockfile', () => {
    expect(lockVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it('the e2e job container image tag is exactly v<lockfile version>-noble', () => {
    expect(ci.jobs.e2e?.container?.image).toBe(`mcr.microsoft.com/playwright:v${lockVersion}-noble`);
  });
  it('is the only Playwright image in ci.yml, and the docker script reads that same one', () => {
    expect(ciText.match(/mcr\.microsoft\.com\/playwright:/g)).toHaveLength(1);
    expect(playwrightImage(ciText)).toBe(ci.jobs.e2e?.container?.image);
  });
  it('the e2e job no longer installs browsers (they are in the image)', () => {
    const runs = (ci.jobs.e2e?.steps ?? []).map((s) => s.run ?? '').join('\n');
    expect(runs).not.toContain('playwright install');
  });
  it('rejects a CI file without an image', () => {
    expect(() => playwrightImage('image: ubuntu')).toThrow();
  });
});

describe('the e2e job runs every pass from scripts/e2e-passes.mjs', () => {
  const runs = (ci.jobs.e2e?.steps ?? []).map((s) => s.run ?? '');
  it.each(PASS_NAMES)('pass "%s" is a CI step', (name) => {
    expect(runs).toContain(`node scripts/e2e-passes.mjs ${name}`);
  });
  it('marks the container for the font test', () => {
    expect(ci.jobs.e2e).toMatchObject({ env: { E2E_CONTAINER: 'true' } });
  });
  it('runs the container as the runner user so Firefox starts', () => {
    expect(ci.jobs.e2e?.container?.options).toMatch(/--user 1001\b/);
  });
});

describe('e2e passes', () => {
  it('keeps the three passes with their ports and drafts settings', () => {
    expect(PASS_NAMES).toEqual(['real', 'shipped', 'fixtures']);
    expect(PASSES['shipped']!.env).toMatchObject({ E2E_PORT: '5050', PUBLIC_INCLUDE_DRAFTS: 'false' });
    expect(PASSES['fixtures']!.env).toMatchObject({ E2E_FIXTURES_PORT: '5390' });
    expect(PASSES['real']!.env).toMatchObject({ PUBLIC_INCLUDE_DRAFTS: 'true', CI: 'true' });
  });
  it('pins the arguments of every pass exactly (narrowing a pass must fail here)', () => {
    expect(PASSES['real']!.args).toEqual(['exec', 'playwright', 'test']);
    expect(PASSES['shipped']!.args).toEqual([
      'exec',
      'playwright',
      'test',
      '--project=chromium',
      '--grep',
      '@smoke|axe',
    ]);
    expect(PASSES['fixtures']!.args).toEqual(['run', 'e2e:fixtures']);
    expect(PASSES['real']!.env).toEqual({
      CI: 'true',
      PUBLIC_INCLUDE_DRAFTS: 'true',
      PUBLIC_CONTENT_FIXTURES: 'false',
    });
    expect(PASSES['shipped']!.env).toEqual({
      CI: 'true',
      PUBLIC_INCLUDE_DRAFTS: 'false',
      PUBLIC_CONTENT_FIXTURES: 'false',
      E2E_PORT: '5050',
    });
    expect(PASSES['fixtures']!.env).toEqual({ CI: 'true', E2E_FIXTURES_PORT: '5390' });
  });
  it('E2E_PROJECTS narrows real and fixtures but never the chromium-only shipped pass', () => {
    expect(passCommand('real', 'chromium, mobile').args).toEqual([
      'exec',
      'playwright',
      'test',
      '--project=chromium',
      '--project=mobile',
    ]);
    expect(passCommand('fixtures', 'chromium').args).toEqual(['run', 'e2e:fixtures', '--project=chromium']);
    expect(passCommand('shipped', 'webkit').args).not.toContain('--project=webkit');
    expect(passCommand('real', undefined).args).toEqual(['exec', 'playwright', 'test']);
  });
  it('selects one pass or all, and rejects unknown names', () => {
    expect(selectPasses('all')).toEqual(PASS_NAMES);
    expect(selectPasses('fixtures')).toEqual(['fixtures']);
    expect(() => selectPasses('nope')).toThrow(/unknown pass/);
  });
});

describe('CI quality job: ci.yml is the visible source of truth, verify reads it', () => {
  const steps = ci.jobs.quality?.steps ?? [];
  const runs = steps.map((s) => s.run).filter((r): r is string => !!r);
  it('ci.yml lists the required gates explicitly, frozen-lockfile install first', () => {
    expect(runs).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm lint',
      'pnpm typecheck',
      'pnpm test',
      'pnpm build',
    ]);
  });
  it('ci.yml gives the build the shipped-build env', () => {
    expect(steps.find((s) => s.run === 'pnpm build')?.env).toEqual({
      PUBLIC_SITE_URL: 'https://shadman-portfolio.web.app',
      PUBLIC_INDEXABLE: 'false',
      PUBLIC_INCLUDE_DRAFTS: 'false',
      PUBLIC_CONTENT_FIXTURES: 'false',
    });
  });
  it('verify derives its steps and env from ci.yml (same as a real YAML parse), not from its own list', () => {
    const parsed = qualitySteps(ciText);
    expect(parsed.map((p) => p.command)).toEqual(runs);
    for (const [i, step] of steps.filter((s) => s.run).entries()) {
      expect(parsed[i]?.env, step.run).toEqual(step.env ?? {});
    }
    const verify = read('scripts/verify.mjs');
    expect(verify).toContain('.github/workflows/ci.yml');
    expect(verify).not.toMatch(/'pnpm (lint|typecheck|test|build)'/);
  });
  it('the parser refuses a ci.yml without a quality job or without run steps', () => {
    expect(() => qualitySteps('jobs:\n  other:\n    steps:\n      - run: pnpm lint\n')).toThrow(
      /no `quality` job/,
    );
    expect(() => qualitySteps('jobs:\n  quality:\n    steps:\n      - uses: actions/checkout@v4\n')).toThrow(
      /no `run:` steps/,
    );
  });
  it('the parser reads a dropped gate as dropped (it follows ci.yml)', () => {
    const without = ciText.replace('      - run: pnpm lint\n', '');
    expect(qualitySteps(without).map((p) => p.command)).not.toContain('pnpm lint');
  });
  it('pnpm build still runs the content check, the dist check and the link check', () => {
    const build = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts.build;
    expect(build).toContain('pnpm content:check');
    expect(build).toContain('scripts/check-dist.ts');
    expect(build).toContain('scripts/check-links.ts');
  });
  it('verify runs all three e2e passes through scripts/e2e-passes.mjs, in docker or locally', () => {
    const verify = read('scripts/verify.mjs');
    expect(verify).toContain("runInDocker('all')");
    expect(verify).toContain('node scripts/e2e-passes.mjs all');
    expect(selectPasses('all')).toEqual(['real', 'shipped', 'fixtures']);
    expect(read('scripts/e2e-docker.mjs')).toContain('node scripts/e2e-passes.mjs "$PASS"');
  });
});

describe('e2e:docker command', () => {
  const base = {
    image: 'img:v1-noble',
    cwd: '/repo',
    pass: 'all',
    platform: 'linux',
    uid: 1000,
    gid: 1001,
    gitDir: true,
  };
  it('mounts the repo, a separate node_modules volume and a read-only .git', () => {
    const a = dockerArgs(base);
    expect(a).toContain('/repo:/work');
    expect(a).toContain(`${volumeName('/repo')}:/work/node_modules`);
    expect(a).toContain('/repo/.git:/work/.git:ro');
    expect(a).toEqual(expect.arrayContaining(['--ipc=host', '--init', '--rm']));
    expect(a.slice(-4, -1)).toEqual(['img:v1-noble', 'bash', '-c']);
    expect(a.at(-1)).toBe(INNER_SCRIPT);
  });
  it('passes the selected pass and the container marker', () => {
    const a = dockerArgs({ ...base, pass: 'fixtures' });
    expect(a).toEqual(expect.arrayContaining(['PASS=fixtures', 'E2E_CONTAINER=true', 'CI=true']));
    expect(() => dockerArgs({ ...base, pass: 'bogus' })).toThrow();
  });
  it('hands files back to the host user on Linux only, and skips .git when it is not a directory', () => {
    expect(dockerArgs(base)).toEqual(expect.arrayContaining(['HOST_UID=1000', 'HOST_GID=1001']));
    expect(
      dockerArgs({ ...base, platform: 'darwin' })
        .slice(0, -1)
        .join(' '),
    ).not.toContain('HOST_UID');
    expect(
      dockerArgs({ ...base, gitDir: false })
        .slice(0, -1)
        .join(' '),
    ).not.toContain('.git:/work/.git');
  });
  it('forwards E2E_PROJECTS when set', () => {
    expect(dockerArgs({ ...base, projects: 'chromium' })).toContain('E2E_PROJECTS=chromium');
  });
  it('uses a volume per checkout path', () => {
    expect(volumeName('/a/repo')).toMatch(/^dev-portfolio-e2e-node-modules-[0-9a-f]{8}$/);
    expect(volumeName('/a/repo')).toBe(volumeName('/a/repo'));
    expect(volumeName('/a/repo')).not.toBe(volumeName('/b/repo'));
  });
  it('chowns everything root-owned outside node_modules and .git on Linux', () => {
    expect(INNER_SCRIPT).toContain('-path ./node_modules -o -path ./.git');
    expect(INNER_SCRIPT).toContain('-user 0');
  });
  it('fails clearly on a Node mismatch instead of installing Node', () => {
    expect(INNER_SCRIPT).not.toMatch(/npm install -g/);
    expect(INNER_SCRIPT).toContain('Bump the Playwright image or .nvmrc');
  });
  it('the inner script reads Node from .nvmrc, pnpm from packageManager, and runs the chosen pass', () => {
    expect(INNER_SCRIPT).toContain('.nvmrc');
    expect(INNER_SCRIPT).toContain('packageManager');
    expect(INNER_SCRIPT).toContain('pnpm install --frozen-lockfile');
    expect(INNER_SCRIPT).toContain('node scripts/e2e-passes.mjs "$PASS"');
  });
});

describe('verify runs its install step non-interactively', () => {
  const install = qualitySteps(ciText).find((s) => /^pnpm install/.test(s.command));

  it('ci.yml keeps the plain frozen-lockfile install (the flag is a verify-only tweak)', () => {
    expect(install?.command).toBe('pnpm install --frozen-lockfile');
  });
  it('adds confirmModulesPurge=false to pnpm install only', () => {
    expect(nonInteractive('pnpm install --frozen-lockfile')).toBe(
      'pnpm install --frozen-lockfile --config.confirmModulesPurge=false',
    );
    expect(nonInteractive('pnpm install')).toContain('--config.confirmModulesPurge=false');
    expect(nonInteractive('pnpm lint')).toBe('pnpm lint');
    expect(nonInteractive('pnpm run install-hooks')).toBe('pnpm run install-hooks');
    expect(nonInteractive('pnpm install --config.confirmModulesPurge=true')).toBe(
      'pnpm install --config.confirmModulesPurge=true',
    );
  });
  it('the real install step, run with no TTY and a node_modules that needs purging, does not prompt', () => {
    // A fake pnpm that behaves like the real one: with no TTY it aborts unless the purge prompt is disabled.
    const dir = mkdtempSync(join(tmpdir(), 'fake-pnpm-'));
    const fake = join(dir, 'pnpm');
    writeFileSync(
      fake,
      '#!/bin/sh\ncase "$*" in *--config.confirmModulesPurge=false*) exit 0;; esac\n' +
        'echo "ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY" >&2; exit 1\n',
    );
    chmodSync(fake, 0o755);
    const run = (command: string) =>
      spawnSync(command, {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CI: '', PATH: `${dir}:${process.env.PATH}` },
      });
    expect(run(install!.command).status).toBe(1); // what the unpatched step did
    expect(run(nonInteractive(install!.command)).status).toBe(0);
  });

  it('stepsToRun gives the flag to the install step only, leaving every other step and env as in ci.yml', () => {
    const plain = qualitySteps(ciText);
    const run = stepsToRun(ciText);
    expect(run).toHaveLength(plain.length);
    run.forEach((step, i) => {
      const original = plain[i]!;
      if (/^pnpm install/.test(original.command)) {
        expect(step.command).toBe(`${original.command} --config.confirmModulesPurge=false`);
      } else {
        expect(step.command).toBe(original.command);
      }
      expect(step.env).toEqual(original.env);
    });
    expect(run.filter((s) => s.command.includes('confirmModulesPurge'))).toHaveLength(1);
  });

  it('main() uses it: `node scripts/verify.mjs --skip-e2e` gets past an install that aborts without a TTY', () => {
    const dir = mkdtempSync(join(tmpdir(), 'verify-main-'));
    mkdirSync(join(dir, '.github/workflows'), { recursive: true });
    writeFileSync(
      join(dir, '.github/workflows/ci.yml'),
      'jobs:\n  quality:\n    steps:\n      - run: pnpm install --frozen-lockfile\n      - run: pnpm lint\n',
    );
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    const log = join(dir, 'calls.log');
    writeFileSync(
      join(bin, 'pnpm'),
      `#!/bin/sh\necho "$*" >> "${log}"\n` +
        'case "$1 $*" in "install "*--config.confirmModulesPurge=false*) exit 0;; "install "*) ' +
        'echo ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY >&2; exit 1;; esac\nexit 0\n',
    );
    chmodSync(join(bin, 'pnpm'), 0o755);
    const r = spawnSync(process.execPath, [resolve('scripts/verify.mjs'), '--skip-e2e'], {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '', PATH: `${bin}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
      'install --frozen-lockfile --config.confirmModulesPurge=false',
      'lint',
    ]);
  });
});
