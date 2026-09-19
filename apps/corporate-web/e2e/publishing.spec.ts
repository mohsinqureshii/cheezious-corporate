import { expect, test } from '@playwright/test';

import { API_URL, RUN_ID, SITE_URL, fetchPublic, signIn } from './support';

/**
 * The publishing round trip.
 *
 * The highest-value end-to-end test in the system, because it crosses every seam
 * the integration suite cannot: the CMS writes, the API decides, and the public
 * site serves — and the properties that matter are only true if all three agree.
 *
 * What it proves:
 *   1. A draft is not on the public site.
 *   2. Publishing puts it there, with its metadata.
 *   3. Editing a published page does **not** change what the public site serves.
 *   4. Preview does show it, on its own uncacheable route.
 *   5. Publishing again releases it.
 *
 * Point three is the one worth having a browser for. It is the whole reason
 * draft and published are separate records, and it is invisible to any test that
 * only reads the database.
 */

test.describe('publishing round trip', () => {
  const title = `${RUN_ID} publishing round trip`;
  const path = `/company/${RUN_ID}-round-trip`;

  let cookie: string;
  let pageId: string;

  test.beforeAll(async ({ playwright }) => {
    const request = await playwright.request.newContext();
    cookie = await signIn(request);
    await request.dispose();
  });

  test('a draft is not on the public site', async ({ request }) => {
    const created = await request.post(`${API_URL}/api/cms/pages`, {
      headers: { Cookie: cookie },
      data: {
        title,
        path,
        locale: 'en',
        type: 'STANDARD',
        summary: 'Created by an end-to-end test. Removed when it finishes.',
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    pageId = (await created.json()).page.id;

    await request.patch(`${API_URL}/api/cms/pages/${pageId}`, {
      headers: { Cookie: cookie },
      data: {
        blocks: [
          {
            blockKey: 'HeroMinimal',
            data: { eyebrow: 'Test', headline: title, standfirst: 'First published text.' },
          },
        ],
      },
    });

    const { status } = await fetchPublic(request, `/en${path}`);
    expect(status, 'a draft must not be reachable on the public site').toBe(404);
  });

  test('publishing puts it live, with its metadata', async ({ request }) => {
    const published = await request.post(`${API_URL}/api/cms/pages/${pageId}/transition`, {
      headers: { Cookie: cookie },
      data: { action: 'PUBLISH' },
    });
    expect(published.ok(), await published.text()).toBeTruthy();

    await expect
      .poll(async () => (await fetchPublic(request, `/en${path}`)).status, { timeout: 30_000 })
      .toBe(200);

    const { body } = await fetchPublic(request, `/en${path}`);
    expect(body).toContain(title);
    expect(body).toContain('First published text.');

    // Every page ships with the metadata a corporate site is judged on.
    expect(body).toMatch(/<meta name="description" content="[^"]+"/);
    expect(body).toContain(`<link rel="canonical" href="`);
    expect(body).toMatch(/<meta property="og:image" content="[^"]+"/);
    expect(body).toContain('application/ld+json');
  });

  test('editing a published page does not change what is served', async ({ request }) => {
    const edited = await request.patch(`${API_URL}/api/cms/pages/${pageId}`, {
      headers: { Cookie: cookie },
      data: {
        blocks: [
          {
            blockKey: 'HeroMinimal',
            data: { eyebrow: 'Test', headline: title, standfirst: 'Edited but not yet published.' },
          },
        ],
      },
    });
    expect(edited.ok(), await edited.text()).toBeTruthy();

    const state = await request.get(`${API_URL}/api/cms/pages/${pageId}`, {
      headers: { Cookie: cookie },
    });
    expect((await state.json()).page.hasUnpublishedChanges).toBe(true);

    // The public site serves the published snapshot, not the working copy.
    const { body } = await fetchPublic(request, `/en${path}`);
    expect(body).toContain('First published text.');
    expect(body).not.toContain('Edited but not yet published.');
  });

  test('preview shows the working copy the public site is withholding', async ({ request }) => {
    const issued = await request.post(`${API_URL}/api/cms/pages/${pageId}/preview`, {
      headers: { Cookie: cookie },
    });
    expect(issued.ok(), await issued.text()).toBeTruthy();
    const { url } = await issued.json();

    // Preview is its own route. The published page keeps its own address, so a
    // preview can never be served in its place — and the route is always
    // dynamic, which is what lets it read a token at all.
    expect(url).toContain(`/en/preview${path}`);

    const preview = await request.get(url, { failOnStatusCode: false });
    expect(preview.status()).toBe(200);
    const body = await preview.text();

    expect(body).toContain('Edited but not yet published.');
    expect(body).toContain('this shows unpublished content');

    // Unpublished content behind a per-editor token must not be cached by
    // anything between the server and that editor.
    expect(preview.headers()['cache-control']).toContain('no-store');
    expect(body).toContain('noindex');
  });

  test('preview without a token is not a second copy of the page', async ({ request }) => {
    const { status } = await fetchPublic(request, `/en/preview${path}`);
    expect(status, 'the preview route must not serve published content').toBe(404);
  });

  test('publishing again releases the edit', async ({ request }) => {
    await request.post(`${API_URL}/api/cms/pages/${pageId}/transition`, {
      headers: { Cookie: cookie },
      data: { action: 'PUBLISH' },
    });

    await expect
      .poll(
        async () =>
          (await fetchPublic(request, `/en${path}`)).body.includes('Edited but not yet published.'),
        {
          timeout: 30_000,
        },
      )
      .toBe(true);

    const { body } = await fetchPublic(request, `/en${path}`);
    expect(body).not.toContain('First published text.');
  });

  test('renaming leaves a redirect behind', async ({ request }) => {
    const newPath = `${path}-renamed`;

    const renamed = await request.patch(`${API_URL}/api/cms/pages/${pageId}`, {
      headers: { Cookie: cookie },
      data: { path: newPath, createRedirect: true },
    });
    expect(renamed.ok(), await renamed.text()).toBeTruthy();

    await expect
      .poll(async () => (await fetchPublic(request, `/en${newPath}`)).status, { timeout: 30_000 })
      .toBe(200);

    // The old address still works, which is what stops a rename quietly
    // breaking every link anybody has ever shared.
    const old = await request.get(`${SITE_URL}/en${path}`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect([301, 307, 308]).toContain(old.status());
  });

  test.afterAll(async ({ playwright }) => {
    if (!pageId) return;
    const request = await playwright.request.newContext();
    await request.post(`${API_URL}/api/cms/pages/${pageId}/transition`, {
      headers: { Cookie: cookie },
      data: { action: 'UNPUBLISH' },
    });
    await request.delete(`${API_URL}/api/cms/pages/${pageId}`, { headers: { Cookie: cookie } });
    await request.dispose();
  });
});
