// SEO = 1 including `is-crawlable`, measured on the real, indexable production build of the home page
// (PUBLIC_INDEXABLE=true) on every page except the noindex 404. Per-route budgets are in lighthouserc.cjs.
const { readdirSync } = process.getBuiltinModule('node:fs');
const urls = readdirSync('./dist')
  .filter((n) => n.endsWith('.html') && n !== '404.html')
  .sort()
  .map((n) => `http://localhost/${n}`);

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: urls,
      numberOfRuns: 3,
      settings: { formFactor: 'mobile', screenEmulation: { mobile: true }, chromeFlags: '--no-sandbox' },
    },
    assert: {
      assertions: {
        'categories:seo': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
        'is-crawlable': ['error', { minScore: 1 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci/indexable' },
  },
};
