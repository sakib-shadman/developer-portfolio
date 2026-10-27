// SEO = 1 including `is-crawlable`, measured on the real, indexable production build of the home page
// (PUBLIC_INDEXABLE=true). Per-route budgets are in lighthouserc.cjs.
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: ['http://localhost/index.html'],
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
