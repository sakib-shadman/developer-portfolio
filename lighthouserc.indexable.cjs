// SEO = 1 including `is-crawlable`, measured on the real, indexable production build of the home page
// (PUBLIC_INDEXABLE=true) on every page except the noindex 404. Per-route budgets are in lighthouserc.cjs.
// Walks dist/ recursively so nested pages (e.g. /projects/<slug>.html case studies) are measured too.
const { readdirSync, statSync } = process.getBuiltinModule('node:fs');
const { join, relative } = process.getBuiltinModule('node:path');
function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return name.endsWith('.html') ? [p] : [];
  });
}
const urls = htmlFiles('./dist')
  .map((p) => relative('./dist', p).split('\\').join('/'))
  .filter((p) => p !== '404.html')
  .sort()
  .map((p) => `http://localhost/${p}`);

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
