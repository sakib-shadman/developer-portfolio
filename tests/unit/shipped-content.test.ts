import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Pins what the shipped site publishes (drafts are excluded from the shipped build, so a silent flip
// back to "draft" would drop the record from production while every build and e2e pass stays green).
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;

describe('shipped content: the CV roles and the four featured projects', () => {
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

  it('publishes and features BlueStack, bKash DSO, Inspector and Financfy, in that order', () => {
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
      'bkash-dso-app',
      'bluestack-ios-sdk',
      'financfy',
      'inspector-android',
    ]);
    expect(
      published
        .filter((p) => p.featured)
        .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0))
        .map((p) => p.id),
    ).toEqual(['bluestack-ios-sdk', 'bkash-dso-app', 'inspector-android', 'financfy']);
  });
});
