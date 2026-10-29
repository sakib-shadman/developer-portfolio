import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Rule {
  source: string;
  headers: { key: string; value: string }[];
}
const config = JSON.parse(readFileSync('firebase.json', 'utf8')) as { hosting: { headers: Rule[] } };
const rules = config.hosting.headers;
const keys = (r: Rule) => r.headers.map((h) => h.key);

describe('firebase.json header rules', () => {
  it('defaults come first: every later rule only overrides (last matching rule wins per header)', () => {
    expect(rules[0]!.source).toBe('**');
    for (const r of rules.slice(1)) expect(r.source).not.toBe('**');
  });

  it('site-wide rule carries the full security header set', () => {
    expect(keys(rules[0]!)).toEqual(
      expect.arrayContaining([
        'Content-Security-Policy',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'Permissions-Policy',
        'Cross-Origin-Opener-Policy',
        'Cross-Origin-Resource-Policy',
        'X-Frame-Options',
        'Cache-Control',
      ]),
    );
  });

  it('CSP never allows inline/eval scripts or wildcards, and every host is https', () => {
    const csp = rules[0]!.headers.find((h) => h.key === 'Content-Security-Policy')!.value;
    const script = csp.split(';').find((d) => d.trim().startsWith('script-src'))!;
    expect(script).not.toMatch(/unsafe-(inline|eval)/);
    expect(csp).not.toMatch(/(^|\s)\*(\s|;|$)/);
    expect(csp).not.toContain('http:');
    for (const host of csp.match(/https:\/\/[^\s;]+/g) ?? []) expect(host).toMatch(/^https:\/\/[a-z.]+$/);
  });

  it('OG images are embeddable cross-origin (link previews) and cached for a day, after the defaults', () => {
    const idx = (source: string) => rules.findIndex((r) => r.source === source);
    expect(idx('/og/**')).toBeGreaterThan(idx('**'));
    const corp = rules[idx('/og/**')]!.headers.find((h) => h.key === 'Cross-Origin-Resource-Policy')?.value;
    expect(corp).toBe('cross-origin');
  });

  it('cache rules: immutable only under /_astro, no-cache default, short-lived feed/resume', () => {
    const cache = (source: string) =>
      rules.find((r) => r.source === source)?.headers.find((h) => h.key === 'Cache-Control')?.value;
    expect(cache('**')).toBe('no-cache');
    expect(cache('/_astro/**')).toBe('public, max-age=31536000, immutable');
    expect(cache('/rss.xml')).toBe('public, max-age=3600');
    expect(cache('/resume/**')).toBe('public, max-age=3600');
    expect(cache('/og/**')).toBe('public, max-age=86400');
    for (const r of rules) {
      if (r.source === '/_astro/**') continue;
      expect(r.headers.find((h) => h.key === 'Cache-Control')?.value ?? '').not.toContain('immutable');
    }
  });
});
