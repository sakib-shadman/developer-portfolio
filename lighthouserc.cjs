// Lighthouse CI over every route of the FIXTURES build (deterministic content, all components present).
// Budgets: ADR-0006. Fixtures builds are noindex by design (astro.config.mjs refuses PUBLIC_INDEXABLE
// there), so `is-crawlable` is skipped here; lighthouserc.indexable.cjs keeps SEO = 1 strict on the real
// indexable build.  Run: `pnpm build:fixtures && pnpm lhci` (or `pnpm lhci:local`).
const { readdirSync, statSync } = process.getBuiltinModule('node:fs');
const { join, relative } = process.getBuiltinModule('node:path');

const dist = './dist-fixtures';

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return name.endsWith('.html') ? [p] : [];
  });
}

const urls = htmlFiles(dist)
  .map((p) => '/' + relative(dist, p).split('\\').join('/'))
  .sort()
  .map((p) => `http://localhost${p}`);

if (urls.length === 0) throw new Error('dist-fixtures is empty. Run `pnpm build:fixtures` first.');

module.exports = {
  ci: {
    collect: {
      staticDistDir: dist,
      url: urls,
      numberOfRuns: Number(process.env.LHCI_RUNS ?? 3),
      settings: {
        formFactor: 'mobile',
        screenEmulation: { mobile: true },
        skipAudits: ['is-crawlable'],
        chromeFlags: '--no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95, aggregationMethod: 'pessimistic' }],
        'categories:accessibility': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
        'categories:best-practices': ['error', { minScore: 0.95, aggregationMethod: 'pessimistic' }],
        'categories:seo': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2000, aggregationMethod: 'pessimistic' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05, aggregationMethod: 'pessimistic' }],
        'resource-summary:script:size': [
          'error',
          { maxNumericValue: 25600, aggregationMethod: 'pessimistic' },
        ],
        'total-byte-weight': ['error', { maxNumericValue: 512000, aggregationMethod: 'pessimistic' }],
      },
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci/fixtures' },
  },
};
