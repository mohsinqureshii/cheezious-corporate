import { apiSchema, parseEnv } from '@cheezious/config';
import { createPrismaClient } from '@cheezious/database';
import { nullLogger } from '@cheezious/logger';
import { MemoryRateLimitStore, RateLimiter, hashPassword } from '@cheezious/auth';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import type { AppContext } from '../lib/context';

/**
 * Integration tests against the real HTTP stack and a real database.
 *
 * These exist because the properties they check are the ones that would be
 * expensive to get wrong and are invisible to unit tests: that an author cannot
 * publish, that Procurement cannot read job applications, that a draft is never
 * served publicly, and that renaming a page leaves a working redirect.
 *
 * Every test creates its own users and content and cleans up after itself, so
 * the suite can run against a development database without wrecking it.
 */

const TEST_PREFIX = `itest-${Date.now()}`;
const PASSWORD = 'integration-test-passphrase-9931';

let ctx: AppContext;
let app: ReturnType<typeof createApp>;
let rateLimitStore: MemoryRateLimitStore;

/**
 * Sign in and return the session cookie.
 *
 * Every request in this suite originates from the same address, so the login
 * rate limit — which is doing exactly what it should in production — would
 * otherwise block the suite after ten sign-ins. The bucket is cleared before
 * each sign-in, and rate limiting is covered by its own test below.
 */
async function signIn(email: string): Promise<string> {
  await rateLimitStore.reset(`login:::ffff:127.0.0.1`);
  await rateLimitStore.reset('login:127.0.0.1');

  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  expect(response.status, `sign-in failed for ${email}: ${JSON.stringify(response.body)}`).toBe(200);
  const cookie = response.headers['set-cookie'];
  return Array.isArray(cookie) ? (cookie[0] ?? '') : String(cookie ?? '');
}

/** Create a user holding exactly the given seeded role. */
async function createUser(suffix: string, roleKey: string): Promise<string> {
  const email = `${TEST_PREFIX}-${suffix}@example.test`;
  const role = await ctx.prisma.role.findUniqueOrThrow({ where: { key: roleKey } });

  await ctx.prisma.user.create({
    data: {
      email,
      name: `Test ${suffix}`,
      passwordHash: await hashPassword(PASSWORD),
      status: 'ACTIVE',
      roles: { create: { roleId: role.id } },
    },
  });

  return email;
}

beforeAll(async () => {
  const env = parseEnv(apiSchema);
  rateLimitStore = new MemoryRateLimitStore();
  ctx = {
    env,
    prisma: createPrismaClient(),
    logger: nullLogger,
    rateLimiter: new RateLimiter(rateLimitStore),
  };
  app = createApp(ctx);
}, 60_000);

afterAll(async () => {
  // Remove everything this run created, in dependency order.
  await ctx.prisma.pageBlock.deleteMany({ where: { page: { path: { startsWith: `/${TEST_PREFIX}` } } } });
  await ctx.prisma.pageSeo.deleteMany({ where: { page: { path: { startsWith: `/${TEST_PREFIX}` } } } });
  await ctx.prisma.slugHistory.deleteMany({ where: { oldPath: { startsWith: `/${TEST_PREFIX}` } } });
  await ctx.prisma.redirect.deleteMany({ where: { source: { startsWith: `/${TEST_PREFIX}` } } });
  await ctx.prisma.contentVersion.deleteMany({ where: { entityType: 'page', entityId: { in: [] } } });
  await ctx.prisma.page.deleteMany({ where: { path: { startsWith: `/${TEST_PREFIX}` } } });
  await ctx.prisma.contentVersion.deleteMany({
    where: { entityType: { in: ['story', 'job'] }, data: { path: ['title'], string_starts_with: TEST_PREFIX } },
  });
  await ctx.prisma.publishingJob.deleteMany({
    where: { entityType: 'story', entityId: { in: [] } },
  });
  await ctx.prisma.supplierSubmission.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
  await ctx.prisma.contactSubmission.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
  await ctx.prisma.job.deleteMany({ where: { title: { startsWith: TEST_PREFIX } } });
  await ctx.prisma.story.deleteMany({ where: { title: { startsWith: TEST_PREFIX } } });
  await ctx.prisma.pressRelease.deleteMany({ where: { headline: { startsWith: TEST_PREFIX } } });
  await ctx.prisma.policy.deleteMany({ where: { title: { startsWith: TEST_PREFIX } } });
  await ctx.prisma.person.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await ctx.prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: TEST_PREFIX } } });
  await ctx.prisma.loginAttempt.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
  await ctx.prisma.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
  await ctx.prisma.$disconnect();
}, 60_000);

describe('health', () => {
  it('reports ready only when the database is reachable', async () => {
    const response = await request(app).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body.checks.database).toBe('ok');
  });
});

describe('authentication', () => {
  it('rejects an unauthenticated CMS request', async () => {
    const response = await request(app).get('/api/cms/pages');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    const email = await createUser('auth', 'AUTHOR');

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'definitely-not-the-password' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ email: `${TEST_PREFIX}-nobody@example.test`, password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    // Identical messages: the endpoint must not reveal which accounts exist.
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
  });

  it('issues an HttpOnly, SameSite session cookie', async () => {
    const email = await createUser('cookie', 'AUTHOR');
    const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });

    const cookie = String(response.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });

  it('never returns a password hash from /me', async () => {
    const email = await createUser('me', 'EDITOR');
    const cookie = await signIn(email);

    const response = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('$argon2');
    expect(response.body.user.passwordHash).toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('blocks repeated failed sign-ins from one address', async () => {
    const email = await createUser('ratelimit', 'VIEWER');
    await rateLimitStore.reset('login:::ffff:127.0.0.1');
    await rateLimitStore.reset('login:127.0.0.1');

    const statuses: number[] = [];
    // The login rule allows 10 attempts per window; the 11th must be refused.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong-password-every-time' });
      statuses.push(response.status);
    }

    expect(statuses.filter((status) => status === 401).length).toBeGreaterThan(0);
    expect(statuses.at(-1)).toBe(429);

    // Cleared so the rest of the suite can sign in.
    await rateLimitStore.reset('login:::ffff:127.0.0.1');
    await rateLimitStore.reset('login:127.0.0.1');
  });
});

describe('permissions', () => {
  it('lets an author create a page but not publish it', async () => {
    const email = await createUser('author', 'AUTHOR');
    const cookie = await signIn(email);

    const created = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Author draft', path: `/${TEST_PREFIX}/author-draft` });

    expect(created.status).toBe(201);
    expect(created.body.page.status).toBe('DRAFT');

    // The author may submit for review…
    const submitted = await request(app)
      .post(`/api/cms/pages/${created.body.page.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'SUBMIT_FOR_REVIEW' });
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe('IN_REVIEW');

    // …but must not be able to publish it themselves.
    const published = await request(app)
      .post(`/api/cms/pages/${created.body.page.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'PUBLISH' });
    expect(published.status).toBe(403);

    const after = await ctx.prisma.page.findUniqueOrThrow({
      where: { id: created.body.page.id },
      select: { status: true },
    });
    expect(after.status).toBe('IN_REVIEW');
  });

  it('refuses an illegal workflow transition with a readable message', async () => {
    const email = await createUser('workflow', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);

    const created = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Workflow test', path: `/${TEST_PREFIX}/workflow` });

    // APPROVE is not legal from DRAFT.
    const response = await request(app)
      .post(`/api/cms/pages/${created.body.page.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'APPROVE' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_TRANSITION');
    expect(response.body.error.message).toMatch(/cannot approve/i);
  });

  it('requires a note when requesting changes', async () => {
    const email = await createUser('note', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);

    const created = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Note test', path: `/${TEST_PREFIX}/note` });

    await request(app)
      .post(`/api/cms/pages/${created.body.page.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'SUBMIT_FOR_REVIEW' });

    const withoutNote = await request(app)
      .post(`/api/cms/pages/${created.body.page.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'REQUEST_CHANGES' });

    expect(withoutNote.status).toBe(422);
    expect(withoutNote.body.error.fields[0].field).toBe('note');
  });

  it('refuses to schedule a publication in the past', async () => {
    const email = await createUser('schedule', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);

    const created = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Schedule test', path: `/${TEST_PREFIX}/schedule` });

    const response = await request(app)
      .post(`/api/cms/pages/${created.body.page.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'SCHEDULE', scheduledFor: new Date(Date.now() - 60_000).toISOString() });

    expect(response.status).toBe(422);
    expect(response.body.error.fields[0].message).toMatch(/future/i);
  });

  it('keeps the submission queues separate by permission', async () => {
    const procurementEmail = await createUser('procurement', 'PROCUREMENT_MANAGER');
    const cookie = await signIn(procurementEmail);

    // Procurement can see its own queue…
    const suppliers = await request(app).get('/api/cms/submissions/suppliers').set('Cookie', cookie);
    expect(suppliers.status).toBe(200);

    // …and must not be able to read applicants or property leads.
    const applications = await request(app).get('/api/cms/submissions/applications').set('Cookie', cookie);
    expect(applications.status).toBe(403);

    const properties = await request(app).get('/api/cms/submissions/properties').set('Cookie', cookie);
    expect(properties.status).toBe(403);
  });

  it('keeps HR out of supplier and property queues', async () => {
    const hrEmail = await createUser('hr', 'HR_MANAGER');
    const cookie = await signIn(hrEmail);

    expect((await request(app).get('/api/cms/submissions/applications').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get('/api/cms/submissions/suppliers').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).get('/api/cms/submissions/properties').set('Cookie', cookie)).status).toBe(403);
  });

  it('refuses role management to an administrator without roles.manage', async () => {
    const email = await createUser('admin', 'ADMIN');
    const cookie = await signIn(email);

    const roles = await request(app).get('/api/cms/system/roles').set('Cookie', cookie);
    expect(roles.status).toBe(200);

    const update = await request(app)
      .patch(`/api/cms/system/roles/${roles.body.roles[0].id}`)
      .set('Cookie', cookie)
      .send({ description: 'Changed by a non-role-manager' });

    expect(update.status).toBe(403);
  });
});

describe('draft and published separation', () => {
  it('never serves an unpublished page publicly, and serves it once published', async () => {
    const email = await createUser('publish', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);
    const path = `/${TEST_PREFIX}/publish-flow`;

    const created = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Publish flow', path, summary: 'A page used by the integration tests.' });
    const pageId = created.body.page.id as string;

    // A draft is not public.
    const beforePublish = await request(app).get('/api/public/en/pages').query({ path });
    expect(beforePublish.status).toBe(404);

    const published = await request(app)
      .post(`/api/cms/pages/${pageId}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'PUBLISH' });
    expect(published.status).toBe(200);

    const afterPublish = await request(app).get('/api/public/en/pages').query({ path });
    expect(afterPublish.status).toBe(200);
    expect(afterPublish.body.page.title).toBe('Publish flow');
  });

  it('does not let an edit to a published page reach the public until it is published again', async () => {
    const email = await createUser('draftsep', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);
    const path = `/${TEST_PREFIX}/draft-separation`;

    const created = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Original title', path });
    const pageId = created.body.page.id as string;

    await request(app)
      .post(`/api/cms/pages/${pageId}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'PUBLISH' });

    // Edit the working copy without publishing.
    const updated = await request(app)
      .patch(`/api/cms/pages/${pageId}`)
      .set('Cookie', cookie)
      .send({ title: 'Edited but not published' });
    expect(updated.status).toBe(200);
    expect(updated.body.page.hasUnpublishedChanges).toBe(true);

    // The public still sees what was approved.
    const publicView = await request(app).get('/api/public/en/pages').query({ path });
    expect(publicView.body.page.title).toBe('Original title');

    // Publishing again makes the edit live.
    await request(app)
      .post(`/api/cms/pages/${pageId}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'PUBLISH' });

    const afterRepublish = await request(app).get('/api/public/en/pages').query({ path });
    expect(afterRepublish.body.page.title).toBe('Edited but not published');
  });

  it('removes an unpublished page from the public site', async () => {
    const email = await createUser('unpublish', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);
    const path = `/${TEST_PREFIX}/unpublish`;

    const created = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'To be unpublished', path });

    await request(app)
      .post(`/api/cms/pages/${created.body.page.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'PUBLISH' });
    expect((await request(app).get('/api/public/en/pages').query({ path })).status).toBe(200);

    await request(app)
      .post(`/api/cms/pages/${created.body.page.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'UNPUBLISH' });

    expect((await request(app).get('/api/public/en/pages').query({ path })).status).toBe(404);
  });
});

describe('slug changes and redirects', () => {
  it('leaves a working redirect when a published page is renamed', async () => {
    const email = await createUser('redirect', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);

    const oldPath = `/${TEST_PREFIX}/old-location`;
    const newPath = `/${TEST_PREFIX}/new-location`;

    const created = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Moving page', path: oldPath });

    await request(app)
      .post(`/api/cms/pages/${created.body.page.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'PUBLISH' });

    const moved = await request(app)
      .patch(`/api/cms/pages/${created.body.page.id}`)
      .set('Cookie', cookie)
      .send({ path: newPath });
    expect(moved.status).toBe(200);

    // The old URL now redirects permanently to the new one.
    const redirect = await request(app).get('/api/public/en/pages').query({ path: oldPath });
    expect(redirect.status).toBe(200);
    expect(redirect.body.redirect.destination).toBe(newPath);
    expect(redirect.body.redirect.statusCode).toBe(301);

    // And the new URL serves the page.
    expect((await request(app).get('/api/public/en/pages').query({ path: newPath })).status).toBe(200);
  });

  it('refuses a path already used by another page', async () => {
    const email = await createUser('conflict', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);
    const path = `/${TEST_PREFIX}/taken`;

    await request(app).post('/api/cms/pages').set('Cookie', cookie).send({ title: 'First', path });
    const second = await request(app).post('/api/cms/pages').set('Cookie', cookie).send({ title: 'Second', path });

    expect(second.status).toBe(422);
    expect(second.body.error.fields[0].field).toBe('path');
  });
});

describe('versioning', () => {
  it('restores an earlier version without destroying history', async () => {
    const email = await createUser('versions', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);

    const created = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Version one', path: `/${TEST_PREFIX}/versions` });
    const pageId = created.body.page.id as string;

    // Publishing captures version 1.
    await request(app)
      .post(`/api/cms/pages/${pageId}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'PUBLISH' });

    await request(app).patch(`/api/cms/pages/${pageId}`).set('Cookie', cookie).send({ title: 'Version two' });
    await request(app)
      .post(`/api/cms/pages/${pageId}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'PUBLISH' });

    const versions = await request(app).get(`/api/cms/pages/${pageId}/versions`).set('Cookie', cookie);
    expect(versions.body.versions.length).toBeGreaterThanOrEqual(2);

    const firstVersion = versions.body.versions[versions.body.versions.length - 1];
    const restored = await request(app)
      .post(`/api/cms/pages/${pageId}/versions/${firstVersion.id}/restore`)
      .set('Cookie', cookie)
      .send({});
    expect(restored.status).toBe(200);

    const page = await ctx.prisma.page.findUniqueOrThrow({ where: { id: pageId }, select: { title: true } });
    expect(page.title).toBe('Version one');

    // Restoring appends: the state before the restore is still recoverable.
    const afterRestore = await request(app).get(`/api/cms/pages/${pageId}/versions`).set('Cookie', cookie);
    expect(afterRestore.body.versions.length).toBeGreaterThan(versions.body.versions.length);
  });

  it('refuses to restore a version belonging to another page', async () => {
    const email = await createUser('crossrestore', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);

    const pageA = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Page A', path: `/${TEST_PREFIX}/page-a` });
    const pageB = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Page B', path: `/${TEST_PREFIX}/page-b` });

    await request(app)
      .post(`/api/cms/pages/${pageA.body.page.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'PUBLISH' });

    const versions = await request(app)
      .get(`/api/cms/pages/${pageA.body.page.id}/versions`)
      .set('Cookie', cookie);

    const response = await request(app)
      .post(`/api/cms/pages/${pageB.body.page.id}/versions/${versions.body.versions[0].id}/restore`)
      .set('Cookie', cookie)
      .send({});

    expect(response.status).toBe(409);
  });
});

describe('block validation', () => {
  it('rejects an invalid block composition rather than saving it', async () => {
    const email = await createUser('blocks', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);

    const created = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Block test', path: `/${TEST_PREFIX}/blocks` });

    // Two heroes on one page is not a valid composition.
    const response = await request(app)
      .patch(`/api/cms/pages/${created.body.page.id}`)
      .set('Cookie', cookie)
      .send({
        blocks: [
          { blockKey: 'HeroEditorial', data: { headline: 'First' } },
          { blockKey: 'HeroEditorial', data: { headline: 'Second' } },
        ],
      });

    expect(response.status).toBe(422);
    expect(response.body.error.fields[0].message).toMatch(/only one/i);

    // Nothing was written: the page still has no blocks.
    const blocks = await ctx.prisma.pageBlock.count({ where: { pageId: created.body.page.id } });
    expect(blocks).toBe(0);
  });

  it('rejects an unknown block type', async () => {
    const email = await createUser('unknownblock', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);

    const created = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Unknown block', path: `/${TEST_PREFIX}/unknown-block` });

    const response = await request(app)
      .patch(`/api/cms/pages/${created.body.page.id}`)
      .set('Cookie', cookie)
      .send({ blocks: [{ blockKey: 'TotallyMadeUpBlock', data: {} }] });

    expect(response.status).toBe(422);
  });
});

describe('audit logging', () => {
  it('records who did what, without recording secrets', async () => {
    const email = await createUser('audit', 'CORPORATE_COMMUNICATIONS');
    const cookie = await signIn(email);

    const created = await request(app)
      .post('/api/cms/pages')
      .set('Cookie', cookie)
      .send({ title: 'Audited page', path: `/${TEST_PREFIX}/audited` });

    const entries = await ctx.prisma.auditLog.findMany({
      where: { entityType: 'page', entityId: created.body.page.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.action).toBe('CREATE');
    expect(entries[0]?.actorEmail).toBe(email);

    // No password material anywhere in the audit trail for this actor.
    const all = await ctx.prisma.auditLog.findMany({ where: { actorEmail: email } });
    expect(JSON.stringify(all)).not.toContain('$argon2');
    expect(JSON.stringify(all)).not.toContain(PASSWORD);
  });
});

describe('public API exposure', () => {
  it('does not expose internal contact routing addresses', async () => {
    const response = await request(app).get('/api/submit/contact-categories');
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('routingEmail');
  });

  it('refuses a forged preview token', async () => {
    const response = await request(app)
      .get('/api/public/en/pages')
      .query({ path: '/company', previewToken: 'not.a.real.token' });

    expect(response.status).toBe(403);
  });
});

describe('account self-service', () => {
  it('refuses a password change without the current password', async () => {
    const email = await createUser('selfservice-wrongpw', 'VIEWER');
    const cookie = await signIn(email);

    const response = await request(app)
      .post('/api/auth/password/change')
      .set('Cookie', cookie)
      .send({ currentPassword: 'not-the-current-password', newPassword: 'another-long-passphrase-4471' });

    expect(response.status).toBe(422);
    expect(response.body.error.fields[0].field).toBe('currentPassword');

    // The old password still works, which is the point of the check.
    await expect(signIn(email)).resolves.toContain('=');
  });

  it('enforces the password policy on the new password', async () => {
    const email = await createUser('selfservice-weak', 'VIEWER');
    const cookie = await signIn(email);

    const response = await request(app)
      .post('/api/auth/password/change')
      .set('Cookie', cookie)
      .send({ currentPassword: PASSWORD, newPassword: 'short' });

    expect(response.status).toBe(422);
    expect(response.body.error.fields.some((field: { field: string }) => field.field === 'newPassword')).toBe(true);
  });

  it('changes the password, ends other sessions and keeps the current one', async () => {
    const email = await createUser('selfservice-change', 'VIEWER');

    const otherCookie = await signIn(email);
    const cookie = await signIn(email);

    const newPassword = 'a-replacement-passphrase-5580';
    const response = await request(app)
      .post('/api/auth/password/change')
      .set('Cookie', cookie)
      .send({ currentPassword: PASSWORD, newPassword });

    expect(response.status).toBe(200);
    expect(response.body.revokedSessions).toBeGreaterThanOrEqual(1);

    // The session that made the change survives; the other one does not.
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', otherCookie)).status).toBe(401);

    // And the old password no longer signs in.
    await rateLimitStore.reset('login:::ffff:127.0.0.1');
    await rateLimitStore.reset('login:127.0.0.1');
    const stale = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(stale.status).toBe(401);
  });

  it('lets a user correct their own name but not their email or roles', async () => {
    const email = await createUser('selfservice-profile', 'VIEWER');
    const cookie = await signIn(email);

    const response = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ name: 'Corrected Name', jobTitle: 'Analyst', email: 'someone-else@example.test', roles: ['SUPER_ADMIN'] });

    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe('Corrected Name');
    // The fields that carry authorisation are ignored, not honoured.
    expect(response.body.user.email).toBe(email);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.user.roles).toEqual(['VIEWER']);
  });

  it('rejects an empty name rather than blanking the profile', async () => {
    const email = await createUser('selfservice-blank', 'VIEWER');
    const cookie = await signIn(email);

    const response = await request(app).patch('/api/auth/me').set('Cookie', cookie).send({ name: '   ' });

    expect(response.status).toBe(422);
  });

  it('lists the caller’s own sessions and no one else’s', async () => {
    const mine = await createUser('selfservice-sessions-a', 'VIEWER');
    const theirs = await createUser('selfservice-sessions-b', 'VIEWER');

    await signIn(theirs);
    const cookie = await signIn(mine);

    const response = await request(app).get('/api/auth/sessions').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.sessions.length).toBe(1);
    expect(response.body.sessions[0].isCurrent).toBe(true);
  });

  it('refuses to end a session belonging to someone else', async () => {
    const mine = await createUser('selfservice-revoke-a', 'VIEWER');
    const theirs = await createUser('selfservice-revoke-b', 'VIEWER');

    const theirCookie = await signIn(theirs);
    const myCookie = await signIn(mine);

    const theirSessions = await request(app).get('/api/auth/sessions').set('Cookie', theirCookie);
    const theirSessionId = theirSessions.body.sessions[0].id;

    const response = await request(app).delete(`/api/auth/sessions/${theirSessionId}`).set('Cookie', myCookie);

    // Not found rather than forbidden: one user has no business learning that
    // another user's session id exists.
    expect(response.status).toBe(404);
    expect((await request(app).get('/api/auth/me').set('Cookie', theirCookie)).status).toBe(200);
  });
});

describe('structured content collections', () => {
  it('lets an author create a story but not publish it', async () => {
    const authorEmail = await createUser('collections-author', 'AUTHOR');
    const cookie = await signIn(authorEmail);

    const created = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({ locale: 'en', title: `${TEST_PREFIX} author story`, excerpt: 'Drafted by an author.' });

    expect(created.status).toBe(201);
    expect(created.body.item.status).toBe('DRAFT');

    const published = await request(app)
      .post(`/api/cms/content/stories/${created.body.item.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'PUBLISH' });

    expect(published.status).toBe(403);

    // And it is still a draft afterwards, not half-transitioned.
    const after = await request(app)
      .get(`/api/cms/content/stories/${created.body.item.id}`)
      .set('Cookie', cookie);
    expect(after.body.item.status).toBe('DRAFT');
  });

  it('keeps Procurement out of people and HR out of suppliers', async () => {
    const procurement = await signIn(await createUser('collections-procurement', 'PROCUREMENT_MANAGER'));
    const hr = await signIn(await createUser('collections-hr', 'HR_MANAGER'));

    expect((await request(app).get('/api/cms/content/people').set('Cookie', procurement)).status).toBe(403);
    expect((await request(app).get('/api/cms/submissions/suppliers').set('Cookie', hr)).status).toBe(403);

    // Each can still reach their own queue.
    expect((await request(app).get('/api/cms/submissions/suppliers').set('Cookie', procurement)).status).toBe(200);
    expect((await request(app).get('/api/cms/submissions/applications').set('Cookie', hr)).status).toBe(200);
  });

  it('sanitises rich text on the way in', async () => {
    const cookie = await signIn(await createUser('collections-sanitise', 'EDITOR'));

    const created = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({
        locale: 'en',
        title: `${TEST_PREFIX} sanitise`,
        body: '<p onclick="steal()">Safe <script>alert(1)</script><a href="javascript:void(0)">link</a></p>',
      });

    expect(created.status).toBe(201);
    const body = created.body.item.body as string;
    expect(body).not.toContain('<script');
    expect(body).not.toContain('onclick');
    expect(body).not.toContain('javascript:');
    expect(body).toContain('Safe');
  });

  it('separates the working copy from what the public site serves', async () => {
    const cookie = await signIn(await createUser('collections-separation', 'CORPORATE_COMMUNICATIONS'));

    const created = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({ locale: 'en', title: `${TEST_PREFIX} separation`, excerpt: 'As published.' });
    const id = created.body.item.id as string;

    await request(app).post(`/api/cms/content/stories/${id}/transition`).set('Cookie', cookie).send({ action: 'PUBLISH' });

    await request(app)
      .patch(`/api/cms/content/stories/${id}`)
      .set('Cookie', cookie)
      .send({ excerpt: 'Edited after publication and not yet live.' });

    const after = await request(app).get(`/api/cms/content/stories/${id}`).set('Cookie', cookie);
    expect(after.body.item.hasUnpublishedChanges).toBe(true);

    // The published snapshot still holds the original text.
    const version = await ctx.prisma.contentVersion.findFirst({
      where: { id: after.body.item.publishedVersionId as string },
    });
    expect((version?.data as { excerpt?: string })?.excerpt).toBe('As published.');
  });

  it('refuses to delete published content until it is unpublished', async () => {
    const cookie = await signIn(await createUser('collections-delete', 'CORPORATE_COMMUNICATIONS'));

    const created = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({ locale: 'en', title: `${TEST_PREFIX} delete guard` });
    const id = created.body.item.id as string;

    await request(app).post(`/api/cms/content/stories/${id}/transition`).set('Cookie', cookie).send({ action: 'PUBLISH' });

    expect((await request(app).delete(`/api/cms/content/stories/${id}`).set('Cookie', cookie)).status).toBe(409);

    await request(app).post(`/api/cms/content/stories/${id}/transition`).set('Cookie', cookie).send({ action: 'UNPUBLISH' });
    expect((await request(app).delete(`/api/cms/content/stories/${id}`).set('Cookie', cookie)).status).toBe(204);
  });

  it('treats opening a job as a publishing act', async () => {
    const editorCookie = await signIn(await createUser('collections-job-editor', 'HR_MANAGER'));

    const created = await request(app)
      .post('/api/cms/content/jobs')
      .set('Cookie', editorCookie)
      .send({ locale: 'en', title: `${TEST_PREFIX} guarded job` });
    expect(created.status).toBe(201);
    expect(created.body.item.status).toBe('DRAFT');

    const opened = await request(app)
      .patch(`/api/cms/content/jobs/${created.body.item.id}`)
      .set('Cookie', editorCookie)
      .send({ status: 'OPEN' });

    // HR can write the posting; whether it goes live is a separate right.
    const hrMayPublish = (await request(app).get('/api/auth/me').set('Cookie', editorCookie)).body.user
      .permissions.includes('careers.publish');
    expect(opened.status).toBe(hrMayPublish ? 200 : 403);
  });

  it('rejects unknown fields rather than silently ignoring them', async () => {
    const cookie = await signIn(await createUser('collections-strict', 'EDITOR'));

    const response = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({ locale: 'en', title: `${TEST_PREFIX} strict`, status: 'PUBLISHED' });

    // `status` is not a writable field: it moves only through the workflow.
    expect(response.status).toBe(422);
  });

  it('derives a unique slug per locale rather than failing on a collision', async () => {
    const cookie = await signIn(await createUser('collections-slug', 'EDITOR'));

    const first = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({ locale: 'en', title: `${TEST_PREFIX} same title` });
    const second = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({ locale: 'en', title: `${TEST_PREFIX} same title` });

    expect(first.body.item.slug).not.toBe(second.body.item.slug);
    expect(second.body.item.slug.endsWith('-2')).toBe(true);
  });
});

describe('media library', () => {
  it('never lists files submitted by the public', async () => {
    const cookie = await signIn(await createUser('media-librarian', 'EDITOR'));

    // A file attached to a job application: personal data belonging to that
    // application, not library material.
    const asset = await ctx.prisma.mediaAsset.create({
      data: {
        kind: 'DOCUMENT',
        storageKey: `private/applications/${TEST_PREFIX}-cv.pdf`,
        originalName: `${TEST_PREFIX}-cv.pdf`,
        mimeType: 'application/pdf',
        byteSize: 1024,
        title: `${TEST_PREFIX} applicant CV`,
        visibility: 'RESTRICTED',
      },
      select: { id: true },
    });

    const list = await request(app)
      .get('/api/cms/media')
      .query({ q: TEST_PREFIX, pageSize: 100 })
      .set('Cookie', cookie);

    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(0);

    // Nor is it reachable by id, which would otherwise make the filter cosmetic.
    const direct = await request(app).get(`/api/cms/media/${asset.id}`).set('Cookie', cookie);
    expect(direct.status).toBe(404);

    await ctx.prisma.mediaAsset.delete({ where: { id: asset.id } });
  });

  it('refuses an upload whose bytes contradict its declared type', async () => {
    const cookie = await signIn(await createUser('media-uploader', 'EDITOR'));

    const response = await request(app)
      .post('/api/cms/media')
      .set('Cookie', cookie)
      .attach('files', Buffer.from('#!/bin/sh\necho not an image\n'), {
        filename: 'payload.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(422);
  });

  it('does not let an editor without the permission flag brand assets', async () => {
    const cookie = await signIn(await createUser('media-brand', 'AUTHOR'));

    const asset = await ctx.prisma.mediaAsset.findFirst({
      where: { deletedAt: null, storageKey: { startsWith: 'media/' } },
      select: { id: true },
    });
    if (!asset) return;

    const response = await request(app)
      .patch(`/api/cms/media/${asset.id}`)
      .set('Cookie', cookie)
      .send({ isBrandAsset: true });

    // Either the route refuses the whole request or the brand flag specifically.
    expect([403]).toContain(response.status);
  });
});

describe('public submission forms', () => {
  const base = {
    contactName: 'Integration Contact',
    email: `${TEST_PREFIX}-supplier@example.test`,
    phone: '0300 1234567',
    consent: true,
    elapsedMs: 9000,
  };

  it('accepts a supplier who gives their own website', async () => {
    // The honeypot used to be called `website`, which is also a real field on
    // this form — so a supplier filling it in truthfully was rejected as a bot.
    const response = await request(app)
      .post('/api/submit/suppliers')
      .send({
        ...base,
        companyName: `${TEST_PREFIX} Dairy`,
        website: 'https://example.com',
        productsServices: 'Cheese and dairy',
      });

    expect(response.status).toBe(201);
    expect(response.body.reference).toMatch(/^SUP-/);

    const stored = await ctx.prisma.supplierSubmission.findFirst({
      where: { email: base.email },
      select: { website: true },
    });
    expect(stored?.website).toBe('https://example.com');
  });

  it('rejects a filled honeypot without naming the field', async () => {
    const response = await request(app)
      .post('/api/submit/suppliers')
      .send({
        ...base,
        email: `${TEST_PREFIX}-bot@example.test`,
        companyName: `${TEST_PREFIX} Bot`,
        productsServices: 'Spam',
        contactFax: '+1 555 0100',
      });

    expect(response.status).toBe(422);
    // Naming the honeypot in the error tells whoever is automating the form
    // exactly which field to leave alone next time.
    expect(JSON.stringify(response.body)).not.toContain('contactFax');
  });

  it('rejects a submission that arrives faster than a person could type it', async () => {
    const response = await request(app)
      .post('/api/submit/suppliers')
      .send({
        ...base,
        email: `${TEST_PREFIX}-fast@example.test`,
        companyName: `${TEST_PREFIX} Fast`,
        productsServices: 'Spam',
        elapsedMs: 40,
      });

    expect(response.status).toBe(422);
  });

  it('does not expose a submission through any public route', async () => {
    const created = await request(app)
      .post('/api/submit/contact')
      .send({
        name: `${TEST_PREFIX} Sender`,
        email: `${TEST_PREFIX}-contact@example.test`,
        subject: 'Integration test',
        message: 'Nothing here should ever be public.',
        consent: true,
        elapsedMs: 9000,
      });
    expect(created.status).toBe(201);

    const reference = created.body.reference as string;

    // Anonymous access to the queue is refused, and the reference is not a key
    // to anything.
    expect((await request(app).get('/api/cms/submissions/contact')).status).toBe(401);
    expect((await request(app).get(`/api/cms/submissions/contact/${reference}`)).status).toBe(401);
  });
});

describe('scheduled publishing', () => {
  it('enqueues exactly one job however many times it is rescheduled', async () => {
    const cookie = await signIn(await createUser('schedule-owner', 'CORPORATE_COMMUNICATIONS'));

    const created = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({ locale: 'en', title: `${TEST_PREFIX} scheduled` });
    const id = created.body.item.id as string;

    const first = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const second = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    for (const scheduledFor of [first, second]) {
      const response = await request(app)
        .post(`/api/cms/content/stories/${id}/transition`)
        .set('Cookie', cookie)
        .send({ action: 'SCHEDULE', scheduledFor });
      expect(response.status).toBe(200);
    }

    // Rescheduling must move the job, not add another — two jobs would publish
    // twice.
    const jobs = await ctx.prisma.publishingJob.findMany({
      where: { entityType: 'story', entityId: id },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe('PENDING');
    expect(jobs[0]?.runAt.toISOString()).toBe(second);

    // Cancelling the schedule cancels the job rather than leaving it to fire.
    await request(app)
      .post(`/api/cms/content/stories/${id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'CANCEL_SCHEDULE' });

    const cancelled = await ctx.prisma.publishingJob.findFirst({
      where: { entityType: 'story', entityId: id },
    });
    expect(cancelled?.status).toBe('CANCELLED');
  });

  it('refuses to schedule a time that has already passed', async () => {
    const cookie = await signIn(await createUser('schedule-past', 'CORPORATE_COMMUNICATIONS'));

    const created = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({ locale: 'en', title: `${TEST_PREFIX} past schedule` });

    const response = await request(app)
      .post(`/api/cms/content/stories/${created.body.item.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'SCHEDULE', scheduledFor: new Date(Date.now() - 60_000).toISOString() });

    expect(response.status).toBe(422);
    expect(response.body.error.fields[0].field).toBe('scheduledFor');
  });

  it('will not let an author schedule what they could not publish', async () => {
    const cookie = await signIn(await createUser('schedule-author', 'AUTHOR'));

    const created = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({ locale: 'en', title: `${TEST_PREFIX} author schedule` });

    const response = await request(app)
      .post(`/api/cms/content/stories/${created.body.item.id}/transition`)
      .set('Cookie', cookie)
      .send({ action: 'SCHEDULE', scheduledFor: new Date(Date.now() + 3_600_000).toISOString() });

    expect(response.status).toBe(403);
  });
});

describe('workflow permissions across content types', () => {
  it('lets every workflow content type run its whole workflow', async () => {
    // Each editorial content type derives the permission it needs as
    // `<prefix>.update` and `<prefix>.publish`. A type missing either is one
    // nobody can move at all, super administrator included — which is how
    // policies shipped unable to be published by anyone.
    const cookie = await signIn(await createUser('workflow-admin', 'SUPER_ADMIN'));

    const types: Array<{ path: string; body: Record<string, unknown> }> = [
      { path: 'stories', body: { locale: 'en', title: `${TEST_PREFIX} workflow story` } },
      { path: 'news', body: { locale: 'en', title: `${TEST_PREFIX} workflow news` } },
      { path: 'press-releases', body: { locale: 'en', headline: `${TEST_PREFIX} workflow release` } },
      { path: 'people', body: { locale: 'en', name: `${TEST_PREFIX} Person`, role: 'Test role' } },
      { path: 'policies', body: { locale: 'en', title: `${TEST_PREFIX} workflow policy` } },
    ];

    for (const type of types) {
      const created = await request(app)
        .post(`/api/cms/content/${type.path}`)
        .set('Cookie', cookie)
        .send(type.body);
      expect(created.status, `create ${type.path}: ${JSON.stringify(created.body)}`).toBe(201);

      const id = created.body.item.id as string;

      for (const action of ['SUBMIT_FOR_REVIEW', 'APPROVE', 'PUBLISH']) {
        const response = await request(app)
          .post(`/api/cms/content/${type.path}/${id}/transition`)
          .set('Cookie', cookie)
          .send({ action });
        expect(response.status, `${type.path} ${action}: ${JSON.stringify(response.body)}`).toBe(200);
      }

      await request(app)
        .post(`/api/cms/content/${type.path}/${id}/transition`)
        .set('Cookie', cookie)
        .send({ action: 'UNPUBLISH' });
      await request(app).delete(`/api/cms/content/${type.path}/${id}`).set('Cookie', cookie);
    }
  });

  it('frees the address when content is deleted', async () => {
    const cookie = await signIn(await createUser('slug-release', 'CORPORATE_COMMUNICATIONS'));
    const title = `${TEST_PREFIX} reusable name`;

    const first = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({ locale: 'en', title });
    const slug = first.body.item.slug as string;

    await request(app).delete(`/api/cms/content/stories/${first.body.item.id}`).set('Cookie', cookie);

    // Deleting a draft called "Annual Report" must not reserve that address
    // forever.
    const second = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({ locale: 'en', title });

    expect(second.status).toBe(201);
    expect(second.body.item.slug).toBe(slug);

    await request(app).delete(`/api/cms/content/stories/${second.body.item.id}`).set('Cookie', cookie);
  });
});

describe('sitemap data', () => {
  it('returns every published page rather than a page of them', async () => {
    const published = await ctx.prisma.page.count({
      where: { locale: 'en', status: 'PUBLISHED', deletedAt: null, excludeFromSitemap: false },
    });

    const response = await request(app).get('/api/public/en/sitemap');

    expect(response.status).toBe(200);
    // The listing endpoints cap at 50 for presentation reasons. Using one here
    // would silently truncate the sitemap and nobody would notice until the
    // fifty-first page stopped being indexed.
    expect(response.body.pages).toHaveLength(published);
  });

  it('carries the translation group so every URL can declare its alternates', async () => {
    const response = await request(app).get('/api/public/en/sitemap');

    for (const collection of ['pages', 'stories', 'pressReleases', 'people', 'policies', 'jobs']) {
      for (const record of response.body[collection] as Array<Record<string, unknown>>) {
        expect(typeof record.translationGroupId).toBe('string');
      }
    }
  });

  it('leaves out what should not be crawled', async () => {
    const cookie = await signIn(await createUser('sitemap-owner', 'CORPORATE_COMMUNICATIONS'));

    const created = await request(app)
      .post('/api/cms/content/stories')
      .set('Cookie', cookie)
      .send({ locale: 'en', title: `${TEST_PREFIX} unpublished story` });

    const before = await request(app).get('/api/public/en/sitemap');
    const slugs = (before.body.stories as Array<{ slug: string }>).map((entry) => entry.slug);

    // A draft has no public URL, so it has no business in the sitemap.
    expect(slugs).not.toContain(created.body.item.slug);

    await request(app).delete(`/api/cms/content/stories/${created.body.item.id}`).set('Cookie', cookie);
  });

  it('offers a social image for every page, even one without its own', async () => {
    const response = await request(app).get('/api/public/en/settings');

    expect(response.status).toBe(200);
    // Without this, a link to a page with no image of its own is shared as a
    // bare URL — which is most of what a newsroom link is worth.
    expect(typeof response.body.settings['seo.defaultOgImageKey']).toBe('string');
  });
});
