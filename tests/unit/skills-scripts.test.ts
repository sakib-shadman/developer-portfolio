import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Behaviour of the bundled skill scripts, against local bare repos and a fake `gh` (no network, no GitHub).
const S = resolve('.claude/skills');
const script = (skill: string, name: string) => join(S, skill, 'scripts', name);

let root: string;
let fakeGh: string;
const IDENT = {
  GIT_AUTHOR_NAME: 'T',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'T',
  GIT_COMMITTER_EMAIL: 't@example.com',
};

function sh(cmd: string, cwd: string, env: Record<string, string> = {}) {
  const r = spawnSync('bash', ['-c', cmd], {
    cwd,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: root,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
      ...IDENT,
      ...env,
    },
  });
  return { status: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
}
const git = (cwd: string, args: string, env: Record<string, string> = {}) => sh(`git ${args}`, cwd, env);

function run(path: string, args: string[], cwd: string, env: Record<string, string> = {}) {
  const r = spawnSync(path, args, {
    cwd,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: root,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
      GH: fakeGh,
      ...IDENT,
      ...env,
    },
  });
  return { status: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
}

/** bare "origin" with develop, plus a working clone of it. */
function makeRepo(name: string) {
  const origin = join(root, `${name}.git`);
  const work = join(root, name);
  sh(`git init -q --bare -b develop ${origin}`, root);
  sh(`git clone -q ${origin} ${work}`, root);
  git(work, 'switch -q -c develop');
  writeFileSync(join(work, 'a.txt'), 'a\n');
  git(work, 'add -A');
  git(work, 'commit -q -m "chore: init"');
  git(work, 'push -q origin develop');
  return { origin, work };
}
const commit = (work: string, file: string, text: string, msg: string) => {
  writeFileSync(join(work, file), text);
  git(work, 'add -A');
  git(work, `commit -q -m "${msg}"`);
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'skills-'));
  fakeGh = join(root, 'fake-gh');
  // Fake gh: logs its arguments to $FAKE/log and answers from fixture files in $FAKE.
  writeFileSync(
    fakeGh,
    `#!/usr/bin/env bash
echo "gh $*" >> "$FAKE/log"
case "$1 $2" in
  "pr list") f="$FAKE/pr_list.json" ;;
  "pr view") f="$FAKE/view.json" ;;
  "pr checks") f="$FAKE/checks.json"; case "$*" in *--watch*) exit "\${FAKE_WATCH_RC:-0}" ;; esac ;;
  "pr create") echo "https://github.com/o/r/pull/7"; exit 0 ;;
  "pr comment") for a in "$@"; do last="$a"; done; cat "$last" > "$FAKE/comment.txt"; exit 0 ;;
  "pr merge" | "pr update-branch" | "pr edit") exit 0 ;;
  api*) echo "error src/a.ts:3 Boom something broke"; exit 0 ;;
  *) f="" ;;
esac
jq_expr=""; prev=""
for a in "$@"; do if [ "$prev" = "--jq" ]; then jq_expr="$a"; fi; prev="$a"; done
[ -n "$f" ] && [ -f "$f" ] || { [ -n "$jq_expr" ] && exit 0; echo "[]"; exit 0; }
if [ -n "$jq_expr" ]; then jq -r "$jq_expr" "$f"; else cat "$f"; fi
`,
  );
  chmodSync(fakeGh, 0o755);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

function fake(name: string, files: Record<string, string> = {}) {
  const dir = join(root, `fake-${name}`);
  mkdirSync(dir, { recursive: true });
  for (const [f, c] of Object.entries(files)) writeFileSync(join(dir, f), c);
  return {
    dir,
    env: { FAKE: dir },
    log: () => (existsSync(join(dir, 'log')) ? readFileSync(join(dir, 'log'), 'utf8') : ''),
  };
}

describe('ship-pr: bundle.sh', () => {
  it('writes a uniquely named, verifiable bundle each time and refuses an empty range', () => {
    const { work } = makeRepo('bundle');
    git(work, 'switch -q -c feature/x');
    commit(work, 'x.txt', 'x', 'feat: x');
    const out = join(root, 'bundles');
    const a = run(script('ship-pr', 'bundle.sh'), ['feature/x', '--out-dir', out], work);
    const b = run(script('ship-pr', 'bundle.sh'), ['feature/x', '--out-dir', out], work);
    expect(a.status).toBe(0);
    expect(b.status).toBe(0);
    const [pa, pb] = [a.out.split('\n').at(-1)!, b.out.split('\n').at(-1)!];
    expect(pa).not.toBe(pb);
    expect(pa).toMatch(/feature-x-\d{8}T\d{6}Z-[0-9a-f]+-\d+\.bundle$/);
    expect(sh(`git bundle verify ${pa}`, work).status).toBe(0);
    // the bundle carries only the branch's own commit and lists the branch ref
    expect(sh(`git bundle list-heads ${pa}`, work).out).toContain('refs/heads/feature/x');
    git(work, 'switch -q develop');
    git(work, 'branch -q empty');
    expect(run(script('ship-pr', 'bundle.sh'), ['empty', '--out-dir', out], work).status).toBe(1);
  });
});

describe('ship-pr: push.sh', () => {
  it('pushes directly when the remote accepts it', () => {
    const { work, origin } = makeRepo('push-ok');
    git(work, 'switch -q -c feature/ok');
    commit(work, 'x.txt', 'x', 'feat: ok');
    const r = run(script('ship-pr', 'push.sh'), ['feature/ok'], work);
    expect(r.status).toBe(0);
    expect(git(origin, 'rev-parse refs/heads/feature/ok').status).toBe(0);
  });
  it('falls back to a bundle and relay instructions (exit 3) when the push is rejected', () => {
    const { work, origin } = makeRepo('push-rejected');
    mkdirSync(join(origin, 'hooks'), { recursive: true });
    writeFileSync(join(origin, 'hooks', 'pre-receive'), '#!/bin/sh\necho "auth denied" >&2\nexit 1\n');
    chmodSync(join(origin, 'hooks', 'pre-receive'), 0o755);
    git(work, 'switch -q -c feature/no');
    commit(work, 'x.txt', 'x', 'feat: no');
    const r = run(script('ship-pr', 'push.sh'), ['feature/no'], work, { BUNDLE_DIR: join(root, 'bundles2') });
    expect(r.status).toBe(3);
    expect(r.err).toContain('Relay path');
    expect(r.err).toMatch(/feature-no-.*\.bundle/);
    expect(r.err).toContain('outside this repo');
  });
  it('refuses a branch whose commit carries a Claude trailer', () => {
    const { work } = makeRepo('push-trailer');
    git(work, 'switch -q -c feature/t');
    writeFileSync(join(work, 'x.txt'), 'x');
    git(work, 'add -A');
    sh(`git commit -q -m "feat: t" -m "Co-Authored-By: Claude <noreply@anthropic.com>"`, work);
    expect(run(script('ship-pr', 'push.sh'), ['feature/t'], work).status).toBe(4);
  });
});

describe('ship-pr: open-pr.sh and comment.sh', () => {
  it('creates a PR against develop with the tip subject as title', () => {
    const { work } = makeRepo('open');
    git(work, 'switch -q -c feature/o');
    commit(work, 'x.txt', 'x', 'feat(x): add x (PF-1)');
    writeFileSync(join(work, 'body.md'), 'body\n');
    const f = fake('open');
    const r = run(script('ship-pr', 'open-pr.sh'), ['feature/o', 'body.md'], work, f.env);
    expect(r.status).toBe(0);
    expect(r.out).toBe('https://github.com/o/r/pull/7');
    expect(f.log()).toContain(
      'pr create --base develop --head feature/o --title feat(x): add x (PF-1) --body-file body.md',
    );
  });
  it('reuses an open PR and only edits the body on request', () => {
    const { work } = makeRepo('open2');
    git(work, 'switch -q -c feature/o2');
    commit(work, 'x.txt', 'x', 'feat: o2');
    writeFileSync(join(work, 'body.md'), 'body\n');
    const f = fake('open2', { 'pr_list.json': '[{"number":5,"url":"https://github.com/o/r/pull/5"}]' });
    const r = run(script('ship-pr', 'open-pr.sh'), ['feature/o2', 'body.md'], work, f.env);
    expect(r.out).toBe('https://github.com/o/r/pull/5');
    expect(f.log()).not.toContain('pr create');
    expect(f.log()).not.toContain('pr edit');
    run(script('ship-pr', 'open-pr.sh'), ['feature/o2', 'body.md', '--update-body'], work, f.env);
    expect(f.log()).toContain('pr edit 5 --body-file body.md');
  });
  it('rejects a title that is not a Conventional Commit', () => {
    const { work } = makeRepo('open3');
    writeFileSync(join(work, 'body.md'), 'body\n');
    const f = fake('open3');
    const r = run(
      script('ship-pr', 'open-pr.sh'),
      ['develop', 'body.md', '--title', 'Update stuff'],
      work,
      f.env,
    );
    expect(r.status).toBe(2);
    expect(f.log()).not.toContain('pr create');
  });
  it('posts a note headed with its kind', () => {
    const { work } = makeRepo('comment');
    writeFileSync(join(work, 'n.md'), 'All good.\n');
    const f = fake('comment');
    const r = run(script('ship-pr', 'comment.sh'), ['7', 'review', 'n.md'], work, f.env);
    expect(r.status).toBe(0);
    expect(readFileSync(join(f.dir, 'comment.txt'), 'utf8')).toBe('**Review**\n\nAll good.\n');
    expect(run(script('ship-pr', 'comment.sh'), ['7', 'nope', 'n.md'], work, f.env).status).toBe(2);
  });
  it('ship.sh stops with exit 3 when the push needs a relay and never opens a PR', () => {
    const { work, origin } = makeRepo('ship');
    writeFileSync(join(origin, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n');
    chmodSync(join(origin, 'hooks', 'pre-receive'), 0o755);
    git(work, 'switch -q -c feature/s');
    commit(work, 'x.txt', 'x', 'feat: s');
    writeFileSync(join(work, 'body.md'), 'body\n');
    const f = fake('ship');
    const r = run(script('ship-pr', 'ship.sh'), ['feature/s', 'body.md'], work, {
      ...f.env,
      BUNDLE_DIR: join(root, 'bundles3'),
    });
    expect(r.status).toBe(3);
    expect(f.log()).not.toContain('pr create');
    const ok = run(script('ship-pr', 'ship.sh'), ['feature/s', 'body.md', '--skip-push'], work, f.env);
    expect(ok.status).toBe(0);
    expect(ok.out).toBe('https://github.com/o/r/pull/7');
  });
});

describe('watch-ci', () => {
  const checks = (rows: [string, string][]) =>
    JSON.stringify(
      rows.map(([name, bucket]) => ({
        name,
        bucket,
        state: bucket,
        link: `https://github.com/o/r/actions/runs/1/job/${name.length}${name.length}`,
      })),
    );
  const ALL = ['branch-policy', 'quality', 'e2e', 'pr-title'];
  it('passes when the four required checks pass (other failures only listed)', () => {
    const f = fake('w1', {
      'checks.json': checks([...ALL.map((n): [string, string] => [n, 'pass']), ['lighthouse', 'fail']]),
    });
    const r = run(script('watch-ci', 'watch-ci.sh'), ['9', '--once'], root, f.env);
    expect(r.status).toBe(0);
    expect(r.out).toContain('RESULT: PASS');
  });
  it('fails and prints annotations of the failing job', () => {
    const f = fake('w2', {
      'checks.json': checks([
        ['branch-policy', 'pass'],
        ['quality', 'pass'],
        ['e2e', 'fail'],
        ['pr-title', 'pass'],
      ]),
    });
    const r = run(script('watch-ci', 'watch-ci.sh'), ['9', '--once'], root, f.env);
    expect(r.status).toBe(1);
    expect(r.out).toContain("annotations for failing job 'e2e' (check-run 33)");
    expect(r.out).toContain('error src/a.ts:3 Boom something broke');
    expect(f.log()).toContain('api repos/{owner}/{repo}/check-runs/33/annotations');
    expect(r.out).toContain('RESULT: FAIL');
  });
  it('treats a missing required check as a failure and a pending one as exit 4', () => {
    const missing = fake('w3', { 'checks.json': checks([['quality', 'pass']]) });
    expect(run(script('watch-ci', 'watch-ci.sh'), ['9', '--once'], root, missing.env).status).toBe(1);
    const pending = fake('w4', {
      'checks.json': checks(ALL.map((n): [string, string] => [n, n === 'e2e' ? 'pending' : 'pass'])),
    });
    const r = run(script('watch-ci', 'watch-ci.sh'), ['9', '--once'], root, pending.env);
    expect(r.status).toBe(4);
    expect(r.out).toContain('RESULT: PENDING');
  });
  it('waits with gh pr checks --watch unless --once', () => {
    const f = fake('w5', { 'checks.json': checks(ALL.map((n): [string, string] => [n, 'pass'])) });
    expect(
      run(script('watch-ci', 'watch-ci.sh'), ['9', '--interval', '5', '--timeout', '30'], root, f.env).status,
    ).toBe(0);
    expect(f.log()).toContain('pr checks 9 --watch --interval 5');
  });
});

describe('merge-pr', () => {
  const view = (o: Record<string, unknown>) =>
    JSON.stringify({
      state: 'OPEN',
      isDraft: false,
      baseRefName: 'develop',
      headRefName: 'feature/m',
      headRefOid: 'abc123',
      mergeStateStatus: 'CLEAN',
      ...o,
    });
  const green = JSON.stringify(
    ['branch-policy', 'quality', 'e2e', 'pr-title'].map((name) => ({
      name,
      bucket: 'pass',
      state: 'SUCCESS',
      link: '',
    })),
  );
  it('refuses without the lead confirming the review verdict', () => {
    const f = fake('m0', { 'view.json': view({}), 'checks.json': green });
    const r = run(script('merge-pr', 'merge-pr.sh'), ['3'], root, f.env);
    expect(r.status).toBe(2);
    expect(f.log()).not.toContain('pr merge');
  });
  it('squash-merges with branch deletion when everything is green', () => {
    const { work } = makeRepo('m1');
    const f = fake('m1', {
      'view.json': view({}),
      'checks.json': green,
      'pr_list.json': '[{"number":4,"headRefName":"feature/n","baseRefName":"feature/m"}]',
    });
    const r = run(script('merge-pr', 'merge-pr.sh'), ['3', '--review-approved'], work, f.env);
    expect(r.status).toBe(0);
    expect(f.log()).toContain('pr merge 3 --squash --delete-branch');
    expect(r.out).toContain('#4 feature/n');
    expect(r.out).toContain('rebase-stack.sh <branch> abc123');
  });
  it('does not merge a draft, a non-develop base, conflicts or red checks', () => {
    const red = JSON.stringify([{ name: 'quality', bucket: 'fail', state: 'FAILURE', link: '' }]);
    for (const [name, v, c] of [
      ['draft', view({ isDraft: true }), green],
      ['base', view({ baseRefName: 'feature/other' }), green],
      ['dirty', view({ mergeStateStatus: 'DIRTY' }), green],
      ['red', view({}), red],
    ] as const) {
      const f = fake(`m-${name}`, { 'view.json': v, 'checks.json': c });
      const r = run(script('merge-pr', 'merge-pr.sh'), ['3', '--review-approved'], root, f.env);
      expect(r.status, name).toBe(1);
      expect(f.log(), name).not.toContain('pr merge');
    }
  });
  it('updates a BEHIND branch with a rebase, waits for CI, then merges', () => {
    const { work } = makeRepo('m2');
    const f = fake('m2', { 'view.json': view({ mergeStateStatus: 'BEHIND' }), 'checks.json': green });
    const r = run(script('merge-pr', 'merge-pr.sh'), ['3', '--review-approved'], work, f.env);
    expect(r.status).toBe(0);
    const log = f.log();
    expect(log.indexOf('pr update-branch 3 --rebase')).toBeGreaterThan(-1);
    expect(log.indexOf('pr checks 3 --watch')).toBeGreaterThan(log.indexOf('update-branch'));
    expect(log.indexOf('pr merge 3')).toBeGreaterThan(log.indexOf('--watch'));
  });
});

describe('rebase-stack', () => {
  /** base PR branch B (2 commits) with stack S (1 commit) on top; B is then squash-merged into develop. */
  function stack(name: string) {
    const { work, origin } = makeRepo(name);
    git(work, 'switch -q -c feature/base');
    commit(work, 'shared.txt', '1', 'feat: b1');
    commit(work, 'shared.txt', '2', 'feat: b2');
    const oldBase = git(work, 'rev-parse HEAD').out;
    git(work, 'switch -q -c feature/stack');
    commit(work, 's.txt', 's', 'feat: s');
    git(work, 'push -q origin feature/base feature/stack');
    // squash merge of the base into develop, done in a second clone like GitHub would
    const other = join(root, `${name}-other`);
    sh(`git clone -q ${origin} ${other}`, root);
    git(other, 'switch -q develop');
    git(other, 'merge -q --squash origin/feature/base');
    git(other, 'commit -q -m "feat: base (#1)"');
    git(other, 'push -q origin develop');
    return { work, origin, oldBase };
  }
  it('moves only the stack commit onto develop and force-pushes with lease', () => {
    const { work, origin, oldBase } = stack('rb1');
    const r = run(script('rebase-stack', 'rebase-stack.sh'), ['feature/stack', oldBase], work, {
      VERIFY_CMD: 'true',
    });
    expect(r.status, r.err).toBe(0);
    expect(git(work, 'log --format=%s origin/develop..feature/stack').out).toBe('feat: s');
    expect(git(work, 'merge-base --is-ancestor origin/develop feature/stack').status).toBe(0);
    // the remote branch was moved
    expect(git(origin, 'log --format=%s -1 feature/stack').out).toBe('feat: s');
    expect(git(origin, 'rev-list --count develop..feature/stack').out).toBe('1');
  });
  it('a plain rebase would replay the squashed commits (why --onto is used)', () => {
    const { work } = stack('rb2');
    git(work, 'fetch -q origin');
    const r = git(work, 'rebase origin/develop');
    expect(r.status).not.toBe(0); // b1 is replayed on top of the squash commit that already contains b2's content
    git(work, 'rebase --abort');
  });
  it('rejects a wrong old-base sha', () => {
    const { work } = stack('rb3');
    git(work, 'fetch -q origin');
    const r = run(
      script('rebase-stack', 'rebase-stack.sh'),
      ['feature/stack', git(work, 'rev-parse origin/develop').out],
      work,
      { VERIFY_CMD: 'true' },
    );
    expect(r.status).toBe(2);
  });
  it('relay mode builds a bundle instead of pushing', () => {
    const { work, origin, oldBase } = stack('rb4');
    const before = git(origin, 'rev-parse feature/stack').out;
    const r = run(script('rebase-stack', 'rebase-stack.sh'), ['feature/stack', oldBase, '--relay'], work, {
      VERIFY_CMD: 'true',
      BUNDLE_DIR: join(root, 'bundles4'),
    });
    expect(r.status, r.err).toBe(0);
    expect(r.out).toMatch(/rebased bundle: .*feature-stack-.*\.bundle/);
    expect(git(origin, 'rev-parse feature/stack').out).toBe(before);
  });
  it('uses the environment identity when the git config has none (it does not write config)', () => {
    const { work, oldBase } = stack('rb5');
    const r = run(script('rebase-stack', 'rebase-stack.sh'), ['feature/stack', oldBase, '--relay'], work, {
      VERIFY_CMD: 'true',
      BUNDLE_DIR: join(root, 'bundles5'),
      GIT_AUTHOR_NAME: '',
      GIT_AUTHOR_EMAIL: '',
      GIT_COMMITTER_NAME: 'Env Person',
      GIT_COMMITTER_EMAIL: 'env@example.com',
    });
    expect(r.status, r.err).toBe(0);
    expect(git(work, 'log -1 --format=%cn feature/stack', { GIT_COMMITTER_NAME: '' }).out).toBe('Env Person');
    expect(git(work, 'config user.name', {}).status).not.toBe(0);
  });
  it('fails clearly with no identity at all', () => {
    const { work, oldBase } = stack('rb6');
    const r = run(script('rebase-stack', 'rebase-stack.sh'), ['feature/stack', oldBase], work, {
      VERIFY_CMD: 'true',
      GIT_AUTHOR_NAME: '',
      GIT_AUTHOR_EMAIL: '',
      GIT_COMMITTER_NAME: '',
      GIT_COMMITTER_EMAIL: '',
    });
    expect(r.status).toBe(1);
    expect(r.err).toContain('no git identity');
  });
  it('stops with exit 5 on conflicts and lists the files; --post-only finishes afterwards', () => {
    const { work, origin } = makeRepo('rb7');
    git(work, 'switch -q -c feature/base');
    commit(work, 'c.txt', 'base\n', 'feat: base');
    const oldBase = git(work, 'rev-parse HEAD').out;
    git(work, 'switch -q -c feature/stack');
    commit(work, 'c.txt', 'stack\n', 'feat: stack edits c');
    const other = join(root, 'rb7-other');
    sh(`git clone -q ${origin} ${other}`, root);
    git(other, 'switch -q develop');
    writeFileSync(join(other, 'c.txt'), 'develop\n');
    git(other, 'add -A');
    git(other, 'commit -q -m "feat: develop c"');
    git(other, 'push -q origin develop');
    const r = run(script('rebase-stack', 'rebase-stack.sh'), ['feature/stack', oldBase], work, {
      VERIFY_CMD: 'true',
    });
    expect(r.status).toBe(5);
    expect(r.err).toContain('c.txt');
    writeFileSync(join(work, 'c.txt'), 'resolved\n');
    git(work, 'add c.txt');
    expect(git(work, 'rebase --continue', { GIT_EDITOR: 'true' }).status).toBe(0);
    const post = run(
      script('rebase-stack', 'rebase-stack.sh'),
      ['feature/stack', oldBase, '--post-only', '--relay'],
      work,
      { VERIFY_CMD: 'true', BUNDLE_DIR: join(root, 'bundles7') },
    );
    expect(post.status, post.err).toBe(0);
  });
  it('stops on a leftover lock file and removes it only with --clean-locks', () => {
    const { work, oldBase } = stack('rb8');
    writeFileSync(join(work, '.git', 'index.lock'), '');
    const env = { VERIFY_CMD: 'true', BUNDLE_DIR: join(root, 'bundles8') };
    expect(
      run(script('rebase-stack', 'rebase-stack.sh'), ['feature/stack', oldBase, '--relay'], work, env).status,
    ).toBe(1);
    expect(existsSync(join(work, '.git', 'index.lock'))).toBe(true);
    const r = run(
      script('rebase-stack', 'rebase-stack.sh'),
      ['feature/stack', oldBase, '--relay', '--clean-locks'],
      work,
      env,
    );
    expect(r.status, r.err).toBe(0);
    expect(existsSync(join(work, '.git', 'index.lock'))).toBe(false);
  });
});
