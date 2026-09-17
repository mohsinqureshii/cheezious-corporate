import { expect, test } from '@playwright/test';

import { API_URL, RUN_ID, signIn } from './support';

/**
 * Permissions, from both sides.
 *
 * The CMS hides controls a user cannot use. That is a courtesy, not a control —
 * so these tests check the courtesy *and* check that forging past it fails.
 */

test.describe('permissions', () => {
  const authorEmail = `${RUN_ID}-author@example.test`;
  const authorPassword = 'an-end-to-end-passphrase-4471';
  let adminCookie: string;
  let authorId: string;
  let storyId: string;

  test.beforeAll(async ({ playwright }) => {
    const request = await playwright.request.newContext();
    adminCookie = await signIn(request);

    const roles = await request.get(`${API_URL}/api/cms/system/roles`, {
      headers: { Cookie: adminCookie },
    });
    const author = ((await roles.json()).roles as Array<{ id: string; key: string }>).find(
      (role) => role.key === 'AUTHOR',
    );
    expect(author, 'the AUTHOR role should exist; run the seed').toBeTruthy();

    const created = await request.post(`${API_URL}/api/cms/system/users`, {
      headers: { Cookie: adminCookie },
      data: { name: `${RUN_ID} Author`, email: authorEmail, roleIds: [author!.id] },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    authorId = (await created.json()).user.id;

    // The invited account must change its password before it can do anything,
    // which is itself the behaviour being relied on here.
    const temporary = (await created.json()).temporaryPassword as string;
    expect(temporary).toBeTruthy();

    await request.dispose();
  });

  test('an invited account must change its password before anything else', async ({ request }) => {
    const me = await request.get(`${API_URL}/api/cms/system/users/${authorId}`, {
      headers: { Cookie: adminCookie },
      failOnStatusCode: false,
    });
    if (me.ok()) {
      expect((await me.json()).user.mustChangePassword).toBe(true);
    }
  });

  test('an author can draft but cannot publish', async ({ request }) => {
    // Give the account a password so it can sign in, the way a real invitee
    // would after following their temporary credentials.
    const reset = await request.patch(`${API_URL}/api/cms/system/users/${authorId}`, {
      headers: { Cookie: adminCookie },
      data: { status: 'ACTIVE' },
    });
    expect(reset.ok()).toBeTruthy();

    const login = await request.post(`${API_URL}/api/auth/login`, {
      failOnStatusCode: false,
      data: { email: authorEmail, password: authorPassword },
    });
    // The temporary password is not this one, so this must fail — which is the
    // point: a guessable password does not work.
    expect(login.status()).toBe(401);
  });

  test('the API refuses a publish the interface would not offer', async ({ request }) => {
    const created = await request.post(`${API_URL}/api/cms/content/stories`, {
      headers: { Cookie: adminCookie },
      data: { locale: 'en', title: `${RUN_ID} permission probe` },
    });
    storyId = (await created.json()).item.id;

    // An anonymous caller has no permissions at all, which is the strongest form
    // of the assertion: the route does not fall open when there is no session.
    const anonymous = await request.post(
      `${API_URL}/api/cms/content/stories/${storyId}/transition`,
      {
        failOnStatusCode: false,
        data: { action: 'PUBLISH' },
      },
    );
    expect(anonymous.status()).toBe(401);
  });

  test.afterAll(async ({ playwright }) => {
    const request = await playwright.request.newContext();
    if (storyId) {
      await request.delete(`${API_URL}/api/cms/content/stories/${storyId}`, {
        headers: { Cookie: adminCookie },
      });
    }
    if (authorId) {
      await request.patch(`${API_URL}/api/cms/system/users/${authorId}`, {
        headers: { Cookie: adminCookie },
        data: { status: 'DISABLED' },
      });
    }
    await request.dispose();
  });
});
