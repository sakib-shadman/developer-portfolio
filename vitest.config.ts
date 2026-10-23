/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// getViteConfig gives tests the same aliases/virtual modules as the Astro build.
export default getViteConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      // queries.ts is thin astro:content I/O — exercised by e2e, not unit tests.
      exclude: ['src/lib/**/types.ts', 'src/lib/content/queries.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
