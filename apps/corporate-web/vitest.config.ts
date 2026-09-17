import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `e2e/` holds Playwright specs, which are run by `pnpm test:e2e` against a
    // live stack. Vitest's default include pattern matches `*.spec.ts` too, so
    // without this it tries to collect them and fails on `test.describe`.
    exclude: ['**/node_modules/**', '**/.next/**', 'e2e/**'],
  },
});
