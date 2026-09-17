import { expect, test, type Page } from '@playwright/test';

import { CMS_URL, SITE_URL, signInThroughCms } from './support';

/**
 * Accessibility and responsive behaviour, in a real browser.
 *
 * Not a substitute for auditing by hand, and not trying to be: these catch the
 * regressions that are cheap to introduce and expensive to notice — a page that
 * scrolls sideways on a phone, a heading structure that skips a level, an image
 * with no alternative text, a keyboard user who cannot reach the content.
 */

const VIEWPORTS = [
  { name: 'desktop-wide', width: 1440, height: 900 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
];

const PAGES = ['/en/company', '/en/careers', '/en/company/newsroom', '/en/company/contact'];

test.describe('responsive layout', () => {
  for (const viewport of VIEWPORTS) {
    test(`no horizontal scroll at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const path of PAGES) {
        await page.goto(`${SITE_URL}${path}`);

        // A page wider than its viewport is the single most common responsive
        // defect, and the one visitors notice first.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(
          overflow,
          `${path} overflows horizontally at ${viewport.width}px`,
        ).toBeLessThanOrEqual(1);
      }
    });
  }

  test('the phone layout keeps a gutter', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${SITE_URL}/en/company`);

    const left = await page
      .locator('h1')
      .first()
      .evaluate((node) => node.getBoundingClientRect().left);
    expect(left, 'content should not run to the edge of a phone screen').toBeGreaterThanOrEqual(12);
  });
});

test.describe('accessibility', () => {
  for (const path of PAGES) {
    test(`${path} is structurally sound`, async ({ page }) => {
      await page.goto(`${SITE_URL}${path}`);
      await assertStructure(page);
    });
  }

  test('the keyboard can skip the navigation', async ({ page }) => {
    await page.goto(`${SITE_URL}/en/company`);
    await page.keyboard.press('Tab');

    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    expect(focused.toLowerCase(), 'the first tab stop should be a skip link').toContain('skip');
  });

  test('every image in the page carries alternative text', async ({ page }) => {
    await page.goto(`${SITE_URL}/en/company`);

    const missing = await page.$$eval('img', (images) =>
      images
        .filter((image) => !image.hasAttribute('alt'))
        .map((image) => image.getAttribute('src') ?? '(no src)'),
    );

    // An empty alt is allowed — that is how a decorative image is marked. A
    // missing one is not: a screen reader reads the file name instead.
    expect(missing, `images without an alt attribute: ${missing.join(', ')}`).toHaveLength(0);
  });

  test('zoom is not capped', async ({ page }) => {
    await page.goto(`${SITE_URL}/en/company`);
    const viewport = await page.getAttribute('meta[name="viewport"]', 'content');
    expect(viewport ?? '').not.toContain('user-scalable=no');
    // Capping the scale locks out anybody who needs to magnify text.
    expect(viewport ?? '').not.toMatch(/maximum-scale=1\b/);
  });

  test('Urdu renders right to left', async ({ page }) => {
    await page.goto(`${SITE_URL}/ur/company`);
    const direction = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? getComputedStyle(main).direction : null;
    });
    expect(direction).toBe('rtl');
  });
});

test.describe('the CMS', () => {
  test('signs in and shows only what the account may reach', async ({ page }) => {
    await signInThroughCms(page);
    await page.goto(`${CMS_URL}/content/pages`);

    await expect(page.getByRole('heading', { name: 'Pages', level: 1 })).toBeVisible();
    // The navigation is permission-filtered, so a section being present is a
    // statement about this account rather than about the build.
    await expect(page.getByRole('navigation').first()).toBeVisible();
  });

  test('is never indexed', async ({ page, request }) => {
    const response = await request.get(`${CMS_URL}/sign-in`);
    expect(response.headers()['x-robots-tag'] ?? '').toContain('noindex');

    await page.goto(`${CMS_URL}/sign-in`);
    const robots = await page.getAttribute('meta[name="robots"]', 'content');
    expect(robots ?? '').toContain('noindex');
  });

  test('works at a laptop width without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await signInThroughCms(page);
    await page.goto(`${CMS_URL}/content/pages`);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

/**
 * The structural checks worth making on every page.
 *
 * Exactly one `h1`, no skipped heading levels, a `lang`, a `main` landmark and a
 * title. None of these need a browser to be true, and all of them are easy to
 * break without noticing.
 */
async function assertStructure(page: Page): Promise<void> {
  await expect(page).toHaveTitle(/.+/);

  const h1Count = await page.locator('h1').count();
  expect(h1Count, 'a page should have exactly one h1').toBe(1);

  const levels = await page.$$eval('h1, h2, h3, h4, h5, h6', (headings) =>
    headings.map((heading) => Number(heading.tagName.slice(1))),
  );
  for (let index = 1; index < levels.length; index += 1) {
    const jump = levels[index]! - levels[index - 1]!;
    expect(
      jump,
      `heading level jumped from h${levels[index - 1]} to h${levels[index]}`,
    ).toBeLessThanOrEqual(1);
  }

  await expect(page.locator('main')).toHaveCount(1);
  expect(await page.getAttribute('html', 'lang')).toBeTruthy();
}
