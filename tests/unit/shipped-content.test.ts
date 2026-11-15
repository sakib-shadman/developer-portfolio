import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Pins what the shipped site publishes (drafts are excluded from the shipped build, so a silent flip
// back to "draft" would drop the record from production while every build and e2e pass stays green).
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;

describe('shipped content: the CV roles, the published projects and the four featured ones', () => {
  it('publishes the five CV roles', () => {
    const experience = json('src/content/experience.json') as unknown as { id: string; status: string }[];
    expect(experience.filter((e) => e.status === 'published').map((e) => e.id)).toEqual([
      'vivasoft-senior-l3',
      'vivasoft-senior-l2',
      'vivasoft-senior-l1',
      'bkash',
      'vivasoft-software-engineer',
    ]);
    expect(experience.filter((e) => e.status !== 'published')).toEqual([]);
  });

  it('publishes the eight CV projects and features BlueStack, bKash DSO, Inspector and Financfy, in that order', () => {
    const projects = readdirSync('src/content/projects').map((f) => ({
      id: f.replace(/\.json$/, ''),
      ...(json(`src/content/projects/${f}`) as {
        status: string;
        featured?: boolean;
        featuredOrder?: number;
      }),
    }));
    const published = projects.filter((p) => p.status === 'published');
    expect(published.map((p) => p.id).sort()).toEqual([
      'amtel-mycash',
      'bkash-customer-app',
      'bkash-dso-app',
      'bluestack-ios-sdk',
      'financfy',
      'inpixon',
      'inspector-android',
      'pihr',
    ]);
    expect(
      published
        .filter((p) => p.featured)
        .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0))
        .map((p) => p.id),
    ).toEqual(['bluestack-ios-sdk', 'bkash-dso-app', 'inspector-android', 'financfy']);
  });

  it('links a case study from each of the four featured projects, and from no other', () => {
    const linked = readdirSync('src/content/projects')
      .map((f) => [f.replace(/\.json$/, ''), json(`src/content/projects/${f}`).caseStudy] as const)
      .filter(([, cs]) => cs !== undefined);
    expect(linked.sort()).toEqual(
      [
        ['bkash-dso-app', 'bkash-dso-app'],
        ['bluestack-ios-sdk', 'bluestack-ios-sdk'],
        ['financfy', 'financfy'],
        ['inspector-android', 'inspector-android'],
      ].sort(),
    );
    expect(
      readdirSync('src/content/case-studies')
        .filter((f) => f.endsWith('.mdx'))
        .sort(),
    ).toEqual(['bkash-dso-app.mdx', 'bluestack-ios-sdk.mdx', 'financfy.mdx', 'inspector-android.mdx']);
  });
});
