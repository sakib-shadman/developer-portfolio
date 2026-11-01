import { readFileSync } from 'node:fs';
import { data, Evaluator, Lexer, Parser } from '@actions/expressions';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const read = (p: string) => readFileSync(p, 'utf8');
const projectId = (JSON.parse(read('.firebaserc')) as { projects: { default: string } }).projects.default;
const origin = `https://${projectId}.web.app`;
// firebase-tools: `FIREBASE_SERVICE_ACCOUNT_${projectId.replace(/-/g, '_').toUpperCase()}`
// (src/init/features/hosting/github.ts)
const secret = `FIREBASE_SERVICE_ACCOUNT_${projectId.toUpperCase().replace(/-/g, '_')}`;
const secretRef = `\${{ secrets.${secret} }}`;

interface Step {
  id?: string;
  uses?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
}
const deployText = read('.github/workflows/deploy.yml');
const deploy = parse(deployText) as { env: Record<string, string>; jobs: { deploy: { steps: Step[] } } };
const steps = deploy.jobs.deploy.steps;
const deployStep = steps.find((s) => s.uses?.startsWith('FirebaseExtended/action-hosting-deploy'));

describe('the Firebase project id has one source (.firebaserc); everything else must agree with it', () => {
  it('is a non-empty string', () => {
    // Not checked against Google's 6-30 character project-id rule: that page could not be fetched,
    // so the exact rule is unverified and deliberately not asserted here.
    expect(typeof projectId).toBe('string');
    expect(projectId.length).toBeGreaterThan(0);
  });
  it('every workflow uses that origin and no other *.web.app host', () => {
    for (const f of ['ci.yml', 'links.yml', 'deploy.yml']) {
      const text = read(`.github/workflows/${f}`);
      const hosts = new Set(text.match(/https:\/\/[a-z0-9-]+\.web\.app/g) ?? []);
      expect([...hosts], f).toEqual([origin]);
    }
  });
  it('deploy.yml: the gate reads the secret, the deploy step uses it and the exact project id', () => {
    expect(steps.find((s) => s.id === 'gate')?.env?.SA).toBe(secretRef);
    expect(deployStep?.with?.firebaseServiceAccount).toBe(secretRef);
    expect(deployStep?.with?.projectId).toBe(projectId);
    expect(deploy.env.SITE_URL).toBe(origin);
  });
  it('deploy.yml uses exactly one FIREBASE* secret, the one firebase init hosting:github creates', () => {
    expect(new Set(deployText.match(/secrets\.FIREBASE\w*/g))).toEqual(new Set([`secrets.${secret}`]));
    expect(deployText.match(new RegExp(`${secret}\\b`, 'g'))!.length).toBeGreaterThanOrEqual(3); // gate, deploy, notice
  });
  it('the docs (including the plan) name the same secret and project, and nothing older', () => {
    for (const f of ['README.md', 'docs/MAINTENANCE.md', 'docs/RELEASE.md', 'docs/IMPLEMENTATION_PLAN.md']) {
      const text = read(f);
      expect(text.match(/shadman-portfolio(?!-96097)[\w-]*/g) ?? [], f).toEqual([]);
      expect(text.match(/FIREBASE_SERVICE_ACCOUNT\w*/g) ?? [], f).toSatisfy((m: string[]) =>
        m.every((x) => x === secret),
      );
    }
  });
});

describe('deploy.yml channelId: PR builds get an auto-named preview channel, main is live, develop is staging', () => {
  const inner = (expr: string) => /^\$\{\{ (.*) \}\}$/.exec(expr.trim())![1]!;
  const str = (v: string) => new data.StringData(v);
  const evaluate = (expr: string, ctx: Record<string, Record<string, string>>) => {
    const dict = new data.Dictionary(
      ...Object.entries(ctx).map(([key, vals]) => ({
        key,
        value: new data.Dictionary(...Object.entries(vals).map(([k, v]) => ({ key: k, value: str(v) }))),
      })),
    );
    const tokens = new Lexer(expr).lex().tokens;
    const parsed = new Parser(tokens, Object.keys(ctx), []).parse();
    return new Evaluator(parsed, dict).evaluate().coerceString();
  };
  // Evaluated with GitHub's own expression library (@actions/expressions), including the IS_LIVE env expression.
  const channel = (event_name: string, ref: string) => {
    const isLive = evaluate(
      inner(read('.github/workflows/deploy.yml').match(/IS_LIVE: (\$\{\{.*\}\})/)![1]!),
      {
        github: { ref, event_name },
      },
    );
    const id = evaluate(inner(deployStep!.with!.channelId!), {
      github: { ref, event_name },
      env: { IS_LIVE: isLive },
    });
    const expires = evaluate(inner(deployStep!.with!.expires!), { github: { ref, event_name } });
    return { id, expires };
  };
  it('pull_request: empty channelId (preview channel), 7d', () => {
    expect(channel('pull_request', 'refs/pull/9/merge')).toEqual({ id: '', expires: '7d' });
  });
  it('push to main: live', () => {
    expect(channel('push', 'refs/heads/main').id).toBe('live');
    expect(channel('workflow_dispatch', 'refs/heads/main').id).toBe('live');
  });
  it('push to develop: staging, 30d', () => {
    expect(channel('push', 'refs/heads/develop')).toEqual({ id: 'staging', expires: '30d' });
  });
  it('the plan documents the same expression', () => {
    expect(read('docs/IMPLEMENTATION_PLAN.md')).toContain(`channelId: ${deployStep!.with!.channelId}`);
  });
});
