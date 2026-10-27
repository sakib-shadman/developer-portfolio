import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// @fixtures suite: runs only tests tagged @fixtures against a build of tests/fixtures/content
// (dist-fixtures/, own port) so blog, case studies, photo, email and resume have browser coverage.
// Run: pnpm e2e:fixtures (builds first). Locally, E2E_FIXTURES_PORT picks another port.
const port = Number(process.env.E2E_FIXTURES_PORT ?? 5390);
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  ...base,
  grep: /@fixtures|@any-content/,
  grepInvert: undefined,
  use: { ...base.use, baseURL },
  webServer: {
    command: 'pnpm build:fixtures && pnpm serve:firebase',
    env: {
      ...(process.env as Record<string, string>),
      E2E_PORT: String(port),
      E2E_DIST: 'dist-fixtures',
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
