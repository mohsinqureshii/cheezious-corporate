import { expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Shared helpers.
 *
 * The CMS is a separate origin from the public site, so tests drive it through
 * its own page context and talk to the API directly where a UI round trip would
 * only be testing the browser.
 */

export const SITE_URL = process.env.E2E_SITE_URL ?? 'http://localhost:3000';
export const CMS_URL = process.env.E2E_CMS_URL ?? 'http://localhost:3001';
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';

/**
 * The account these tests use, supplied by the environment.
 *
 * It is deliberately not the seeded administrator: that account is required to
 * change its password at first sign-in, and a test that changed it would leave
 * the documented credentials wrong for whoever runs the seed next. It is equally
 * deliberately not defaulted here — a password committed to a repository is a
 * password, and the seed is careful not to create one. Provision the account
 * with `pnpm --filter @cheezious/api e2e:account`.
 */
export const E2E_EMAIL = requiredEnv('E2E_EMAIL');
export const E2E_PASSWORD = requiredEnv('E2E_PASSWORD');

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. The end-to-end suite signs in as a real account; create one with ` +
        '`pnpm --filter @cheezious/api e2e:account` and put E2E_EMAIL and E2E_PASSWORD in .env.',
    );
  }
  return value;
}

/** A run-scoped prefix, so a failed run's leftovers are identifiable. */
export const RUN_ID = `e2e-${Date.now().toString(36)}`;

/**
 * Sign in to the API and return a session cookie.
 *
 * Memoised for the life of the process. The login route is rate limited per
 * address — as it should be — and a suite that signs in once per spec spends
 * that budget on itself and then fails in a way that looks like a bug in the
 * product.
 */
let cachedSession: Promise<string> | null = null;

export async function signIn(request: APIRequestContext): Promise<string> {
  cachedSession ??= (async () => {
    const response = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
      failOnStatusCode: false,
    });

    expect(
      response.ok(),
      `Could not sign in as ${E2E_EMAIL} (${response.status()}). Check the stack is up and the ` +
        'account exists — `pnpm --filter @cheezious/api e2e:account` creates it. A 429 means an ' +
        'earlier run spent the login rate limit; wait a few minutes.',
    ).toBeTruthy();

    const cookies = response.headers()['set-cookie'] ?? '';
    return cookies.split(';')[0] ?? '';
  })();

  return cachedSession;
}

/** Sign in through the CMS interface, leaving the browser authenticated. */
export async function signInThroughCms(page: Page): Promise<void> {
  await page.goto(`${CMS_URL}/sign-in`);
  await page.getByLabel('Email address').fill(E2E_EMAIL);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

/**
 * Fetch a public page, bypassing the revalidation window.
 *
 * The site is statically generated with ISR, so the first request after a
 * publish can still serve the previous render. A cache-busting query is enough:
 * the route is dynamic in its params, not in its query.
 */
export async function fetchPublic(
  request: APIRequestContext,
  path: string,
): Promise<{ status: number; body: string }> {
  const response = await request.get(`${SITE_URL}${path}?cb=${Date.now()}`, {
    failOnStatusCode: false,
  });
  return { status: response.status(), body: await response.text() };
}
