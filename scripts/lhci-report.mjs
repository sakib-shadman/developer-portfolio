// Prints a per-route table (median-by-performance run) from .lighthouseci/<dir>/*.report.json.
// Usage: node scripts/lhci-report.mjs [dir=.lighthouseci/fixtures]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? '.lighthouseci/fixtures';
const byUrl = new Map();
for (const f of readdirSync(dir).filter((n) => /\.report\.json$/.test(n))) {
  const lhr = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const path = new URL(lhr.finalUrl ?? lhr.requestedUrl).pathname;
  byUrl.set(path, [...(byUrl.get(path) ?? []), lhr]);
}
const pct = (n) => Math.round(n * 100);
const kb = (n) => (n / 1024).toFixed(1);
const rows = [...byUrl.entries()].sort().map(([path, runs]) => {
  runs.sort((a, b) => a.categories.performance.score - b.categories.performance.score);
  const r = runs[Math.floor(runs.length / 2)];
  const a = r.audits;
  const script = a['resource-summary'].details.items.find((i) => i.resourceType === 'script');
  return [
    path,
    pct(r.categories.performance.score),
    pct(r.categories.accessibility.score),
    pct(r.categories['best-practices'].score),
    pct(r.categories.seo.score),
    Math.round(a['largest-contentful-paint'].numericValue),
    a['cumulative-layout-shift'].numericValue.toFixed(3),
    kb(script?.transferSize ?? 0),
    kb(a['total-byte-weight'].numericValue),
  ];
});
console.log(['route', 'perf', 'a11y', 'bp', 'seo', 'LCP ms', 'CLS', 'JS KB', 'total KB'].join(' | '));
for (const r of rows) console.log(r.join(' | '));
