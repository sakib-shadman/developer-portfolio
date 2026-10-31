import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { dockerArgs, INNER_SCRIPT, playwrightImage, VOLUME } from '../../scripts/e2e-docker.mjs';
import { PASS_NAMES, PASSES, passCommand, selectPasses } from '../../scripts/e2e-passes.mjs';
import { BUILD_ENV, QUALITY_STEPS } from '../../scripts/verify.mjs';

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
});

describe('e2e passes', () => {
  it('keeps the three passes with their ports and drafts settings', () => {
    expect(PASS_NAMES).toEqual(['real', 'shipped', 'fixtures']);
    expect(PASSES['shipped']!.env).toMatchObject({ E2E_PORT: '5050', PUBLIC_INCLUDE_DRAFTS: 'false' });
    expect(PASSES['fixtures']!.env).toMatchObject({ E2E_FIXTURES_PORT: '5390' });
    expect(PASSES['real']!.env).toMatchObject({ PUBLIC_INCLUDE_DRAFTS: 'true', CI: 'true' });
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

describe('pnpm verify mirrors the CI quality job', () => {
  const quality = ci.jobs.quality?.steps.map((s) => s.run).filter((r): r is string => !!r);
  it('runs the same commands in the same order', () => {
    expect(QUALITY_STEPS).toEqual(quality);
  });
  it('gives the build the same env as CI', () => {
    const build = ci.jobs.quality?.steps.find((s) => s.run === 'pnpm build');
    expect(build?.env).toEqual(BUILD_ENV);
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
    expect(a).toContain(`${VOLUME}:/work/node_modules`);
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
  it('the inner script reads Node from .nvmrc, pnpm from packageManager, and runs the chosen pass', () => {
    expect(INNER_SCRIPT).toContain('.nvmrc');
    expect(INNER_SCRIPT).toContain('packageManager');
    expect(INNER_SCRIPT).toContain('pnpm install --frozen-lockfile');
    expect(INNER_SCRIPT).toContain('node scripts/e2e-passes.mjs "$PASS"');
  });
});
