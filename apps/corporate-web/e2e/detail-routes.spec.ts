import { expect, test } from '@playwright/test';

import { API_URL, RUN_ID, fetchPublic, signIn } from './support';

/**
 * The three collections that are published by a flag rather than by the
 * workflow: reports, impact stories and employee stories.
 *
 * They are worth their own spec because they were, until recently, the one part
 * of the platform where the CMS managed content nothing on the public site could
 * read. The properties asserted here are the ones that made that true:
 *
 *   1. An unpublished record 404s.
 *   2. Publishing gives it a page, with its own metadata and structured data.
 *   3. That page appears immediately, not when the revalidation window elapses —
 *      which only works if the tag the API invalidates is the tag the public
 *      site fetched under. Those two vocabularies did not agree.
 *   4. Unpublishing takes the page away again.
 */

// Serial: these steps are one story told in order, and a later step asserted
// against a record an earlier step failed to create would report a second
// failure that is really the first one again.
test.describe.configure({ mode: 'serial' });

test.describe('publication detail pages', () => {
  const title = `${RUN_ID} Corporate Publication`;
  const path = () => `/en/company/resources/publications/${slug}`;
  let cookie: string;
  let id: string;
  let slug: string;

  test.beforeAll(async ({ playwright }) => {
    const request = await playwright.request.newContext();
    cookie = await signIn(request);

    const created = await request.post(`${API_URL}/api/cms/content/reports`, {
      headers: { Cookie: cookie },
      data: {
        title,
        locale: 'en',
        year: 2026,
        type: 'FACT_SHEET',
        description: 'Created by an end-to-end test. Removed when it finishes.',
        isPublished: false,
      },
    });
    expect(created.status(), await created.text()).toBe(201);

    const body = await created.json();
    id = body.item.id;
    slug = body.item.slug;

    await request.dispose();
  });

  test.afterAll(async ({ playwright }) => {
    if (!id) return;
    const request = await playwright.request.newContext();
    await request.delete(`${API_URL}/api/cms/content/reports/${id}`, {
      headers: { Cookie: cookie },
      failOnStatusCode: false,
    });
    await request.dispose();
  });

  test('an unpublished report has no public page', async ({ request }) => {
    expect(slug, 'the API derives a slug from the title').toBeTruthy();

    const page = await fetchPublic(request, path());
    expect(page.status).toBe(404);
  });

  test('publishing gives it a page, immediately', async ({ request }) => {
    const published = await request.patch(`${API_URL}/api/cms/content/reports/${id}`, {
      headers: { Cookie: cookie },
      data: { isPublished: true },
    });
    expect(published.status(), await published.text()).toBe(200);

    const page = await fetchPublic(request, `/en/company/resources/publications/${slug}`);
    expect(page.status, 'a publish should clear the public cache rather than wait for ISR').toBe(
      200,
    );
    expect(page.body).toContain(title);
  });

  test('the page carries its own metadata and structured data', async ({ request }) => {
    const page = await fetchPublic(request, path());

    expect(page.body).toContain(
      `<link rel="canonical" href="http://localhost:3000/en/company/resources/publications/${slug}"/>`,
    );
    expect(page.body).toContain('"@type":"Report"');
    // The breadcrumb matters to search results, which show it in place of the URL.
    expect(page.body).toContain('"@type":"BreadcrumbList"');
  });

  test('it reaches the sitemap', async ({ request }) => {
    const sitemap = await fetchPublic(request, '/sitemap.xml');
    expect(sitemap.status).toBe(200);
    expect(sitemap.body).toContain(`/en/company/resources/publications/${slug}`);
  });

  test('unpublishing takes the page away again', async ({ request }) => {
    const unpublished = await request.patch(`${API_URL}/api/cms/content/reports/${id}`, {
      headers: { Cookie: cookie },
      data: { isPublished: false },
    });
    expect(unpublished.status()).toBe(200);

    const page = await fetchPublic(request, path());
    expect(page.status).toBe(404);
  });
});

test.describe('the story detail routes that were missing', () => {
  test('an impact story is reachable from its listing', async ({ request }) => {
    const listing = await fetchPublic(request, '/en/company/impact/stories');
    expect(listing.status).toBe(200);

    const match = listing.body.match(/href="(\/en\/company\/impact\/stories\/[^"]+)"/);
    expect(match, 'the listing should link to at least one story').toBeTruthy();

    const detail = await fetchPublic(request, match![1]!);
    expect(detail.status).toBe(200);
    expect(detail.body).toContain('"@type":"Article"');
  });

  test('an employee story is reachable from its listing', async ({ request }) => {
    const listing = await fetchPublic(request, '/en/company/people/stories');
    expect(listing.status).toBe(200);

    const match = listing.body.match(/href="(\/en\/company\/people\/stories\/[^"]+)"/);
    expect(match, 'the listing should link to at least one story').toBeTruthy();

    const detail = await fetchPublic(request, match![1]!);
    expect(detail.status).toBe(200);
    expect(detail.body).toContain('"@type":"Article"');
  });
});
