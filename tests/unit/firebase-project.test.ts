import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');
const projectId = (JSON.parse(read('.firebaserc')) as { projects: { default: string } }).projects.default;
const origin = `https://${projectId}.web.app`;
const secret = `FIREBASE_SERVICE_ACCOUNT_${projectId.toUpperCase().replace(/-/g, '_')}`;

describe('the Firebase project id has one source (.firebaserc); everything else must agree with it', () => {
  it('is a plausible project id', () => {
    expect(projectId).toMatch(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
  });
  it('every workflow uses that origin for PUBLIC_SITE_URL / SITE_URL and no other *.web.app host', () => {
    for (const f of ['ci.yml', 'links.yml', 'deploy.yml']) {
      const text = read(`.github/workflows/${f}`);
      const hosts = new Set(text.match(/https:\/\/[a-z0-9-]+\.web\.app/g) ?? []);
      expect([...hosts], f).toEqual([origin]);
    }
  });
  it('deploy.yml deploys to that project with the secret firebase init hosting:github creates for it', () => {
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).toContain(`projectId: ${projectId}`);
    const names = new Set(deploy.match(/FIREBASE_SERVICE_ACCOUNT_[A-Z0-9_]+/g));
    expect([...names]).toEqual([secret]);
  });
  it('the docs name the same secret and project, and nothing older', () => {
    for (const f of ['README.md', 'docs/MAINTENANCE.md', 'docs/RELEASE.md']) {
      const text = read(f);
      expect(text.match(/shadman-portfolio(?!-96097)[\w-]*/g) ?? [], f).toEqual([]);
      expect(text.match(/FIREBASE_SERVICE_ACCOUNT_[A-Z0-9_]+/g) ?? [], f).toSatisfy((m: string[]) =>
        m.every((x) => x === secret),
      );
    }
  });
});
