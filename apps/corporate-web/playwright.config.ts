import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests.
 *
 * These exist for the seams the integration suite cannot reach: the CMS and the
 * public site are separate applications talking to the same API, and the
 * properties that matter most — that a draft is not live, that an edit to a
 * published page is not live until it is published again — are only true if all
 * three agree.
 *
 * They run against an already-running stack rather than starting one, because
 * the API and the worker are separate processes and a web server started by the
 * test runner would be only one of them. `pnpm dev` first, then `pnpm test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  // Sequential on purpose: these tests publish content, and two of them
  // publishing at once would make each other's assertions ambiguous.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.E2E_SITE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Deliberately no blanket request headers. `Cache-Control` is not a
    // CORS-safelisted request header, so setting it globally makes every
    // cross-origin fetch the CMS performs require a preflight — and a suite that
    // changes how the browser talks to the API is testing itself. Cache busting
    // is done per request instead, with a query parameter.
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // The browser is provided by the environment rather than downloaded by
        // Playwright. `PLAYWRIGHT_CHROMIUM_PATH` lets CI point at its own build;
        // without it Playwright resolves the browser it manages, which is the
        // right behaviour on a developer's machine.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
});
