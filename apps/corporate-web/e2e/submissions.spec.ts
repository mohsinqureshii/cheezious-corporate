import { expect, test } from '@playwright/test';

import { API_URL, RUN_ID, SITE_URL, signIn } from './support';

/**
 * The supplier submission round trip.
 *
 * A supplier fills in a public form; Procurement finds it in their queue. That
 * crosses the anonymous side of the API, the queue's permission boundary and the
 * CSV export, and each of those has failed in a different way during this build.
 */

test.describe('supplier submission', () => {
  const email = `${RUN_ID}-supplier@example.test`;
  const company = `${RUN_ID} Northern Dairy`;
  let reference: string;

  test('a supplier can submit, website and all', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/submit/suppliers`, {
      data: {
        companyName: company,
        website: 'https://example.com',
        contactName: 'End To End',
        email,
        phone: '0300 1234567',
        productsServices: 'Cheese and dairy products.',
        citiesServed: ['Islamabad', 'Lahore'],
        consent: true,
        elapsedMs: 9_000,
      },
    });

    expect(response.status(), await response.text()).toBe(201);
    const body = await response.json();
    expect(body.reference).toMatch(/^SUP-/);
    reference = body.reference;
  });

  test('a bot filling the honeypot is refused, and not told why', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/submit/suppliers`, {
      failOnStatusCode: false,
      data: {
        companyName: `${RUN_ID} Bot`,
        contactName: 'Bot',
        email: `${RUN_ID}-bot@example.test`,
        phone: '0300 1234567',
        productsServices: 'Spam',
        consent: true,
        elapsedMs: 9_000,
        contactFax: '+1 555 0100',
      },
    });

    expect(response.status()).toBe(422);
    // Naming the honeypot in the error tells whoever is automating the form
    // which field to leave alone next time.
    expect(await response.text()).not.toContain('contactFax');
  });

  test('it is not reachable without a session', async ({ request }) => {
    const anonymous = await request.get(`${API_URL}/api/cms/submissions/suppliers`, {
      failOnStatusCode: false,
    });
    expect(anonymous.status()).toBe(401);
  });

  test('Procurement finds it in their queue and can export it', async ({ request }) => {
    const cookie = await signIn(request);

    const list = await request.get(`${API_URL}/api/cms/submissions/suppliers?q=${RUN_ID}`, {
      headers: { Cookie: cookie },
    });
    expect(list.ok()).toBeTruthy();

    const items = (await list.json()).items as Array<{ reference: string; companyName: string }>;
    const found = items.find((item) => item.reference === reference);
    expect(found, 'the submission should appear in the queue it belongs to').toBeTruthy();
    expect(found?.companyName).toBe(company);

    const csv = await request.get(`${API_URL}/api/cms/submissions/suppliers/export?q=${RUN_ID}`, {
      headers: { Cookie: cookie },
    });
    expect(csv.ok()).toBeTruthy();
    const text = await csv.text();
    expect(text).toContain(reference);
    // Excel reads a UTF-8 CSV as the local code page without a byte-order mark,
    // which mangles every non-Latin name in the export.
    expect(text.charCodeAt(0)).toBe(0xfeff);
  });

  test('the public site never exposes a submission', async ({ request }) => {
    const search = await request.get(`${SITE_URL}/en/search?q=${encodeURIComponent(company)}`, {
      failOnStatusCode: false,
    });
    expect(await search.text()).not.toContain(email);
  });

  test.afterAll(async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const cookie = await signIn(request);
    const list = await request.get(`${API_URL}/api/cms/submissions/suppliers?q=${RUN_ID}`, {
      headers: { Cookie: cookie },
    });
    for (const item of ((await list.json()).items ?? []) as Array<{ id: string }>) {
      await request.patch(`${API_URL}/api/cms/submissions/suppliers/${item.id}`, {
        headers: { Cookie: cookie },
        data: { status: 'ARCHIVED' },
      });
    }
    await request.dispose();
  });
});
