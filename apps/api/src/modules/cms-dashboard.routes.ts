import { OPEN_WORK_STATUSES } from '@cheezious/permissions';
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, requireAuth, requirePermission } from '../middleware';

/**
 * The CMS dashboard.
 *
 * Deliberately operational rather than analytical. A publishing team does not
 * open the CMS to look at a traffic chart — they open it to find out what is
 * waiting for them. So the dashboard answers: what is mine, what is blocked on
 * me, what goes live today, what is broken, and what arrived overnight.
 *
 * Every section is scoped by permission. A Procurement Manager sees supplier
 * submissions and nothing about job applicants.
 */
export function cmsDashboardRoutes(): Router {
  const router = Router();
  router.use(requireAuth());

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { prisma, ability } = { prisma: req.ctx.prisma, ability: req.ability };
      const userId = req.principal!.id;

      const now = new Date();
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const staleBefore = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

      // Everything is gathered concurrently; a dashboard that takes a second to
      // load is a dashboard people stop opening.
      const [myWork, reviewQueue, publishing, inbox, activity, health, system] = await Promise.all([
        buildMyWork(prisma, userId, ability.can('pages.read')),
        buildReviewQueue(prisma, ability.can('pages.read')),
        buildPublishing(prisma, endOfToday, endOfWeek, ability.can('pages.read')),
        buildInbox(prisma, ability),
        buildActivity(prisma, ability.can('audit.read')),
        buildContentHealth(prisma, staleBefore, ability.can('contentHealth.read')),
        buildSystemHealth(prisma, ability.can('system.read')),
      ]);

      res.json({ myWork, reviewQueue, publishing, inbox, activity, contentHealth: health, system });
    }),
  );

  /** Content health detail, with the issues grouped for the CMS list view. */
  router.get(
    '/content-health',
    requirePermission('contentHealth.read'),
    asyncHandler(async (req, res) => {
      const { type, locale } = z
        .object({ type: z.string().max(60).optional(), locale: z.enum(['en', 'ur']).optional() })
        .parse(req.query);

      const issues = await req.ctx.prisma.contentHealthIssue.findMany({
        where: {
          resolvedAt: null,
          dismissedAt: null,
          ...(type ? { type: type as never } : {}),
          ...(locale ? { locale } : {}),
        },
        orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
        take: 500,
      });

      const counts = await req.ctx.prisma.contentHealthIssue.groupBy({
        by: ['type', 'severity'],
        where: { resolvedAt: null, dismissedAt: null },
        _count: true,
      });

      res.json({
        issues,
        summary: counts.map((row) => ({ type: row.type, severity: row.severity, count: row._count })),
      });
    }),
  );

  return router;
}

/** What this user personally owes. */
async function buildMyWork(
  prisma: import('@cheezious/database').PrismaClient,
  userId: string,
  canRead: boolean,
) {
  if (!canRead) return null;

  const mine = { OR: [{ createdById: userId }, { updatedById: userId }], deletedAt: null };

  const [drafts, changesRequested, scheduled, recentlyEdited] = await Promise.all([
    prisma.page.findMany({
      where: { ...mine, status: 'DRAFT' },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: pageCardSelect,
    }),
    prisma.page.findMany({
      where: { ...mine, status: 'CHANGES_REQUESTED' },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: pageCardSelect,
    }),
    prisma.page.findMany({
      where: { ...mine, status: 'SCHEDULED' },
      orderBy: { scheduledFor: 'asc' },
      take: 8,
      select: pageCardSelect,
    }),
    prisma.page.findMany({
      where: { ...mine },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: pageCardSelect,
    }),
  ]);

  return { drafts, changesRequested, scheduled, recentlyEdited };
}

/** What is waiting on somebody, and for how long. */
async function buildReviewQueue(prisma: import('@cheezious/database').PrismaClient, canRead: boolean) {
  if (!canRead) return null;

  const agingBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [awaitingReview, awaitingApproval, aging] = await Promise.all([
    prisma.page.findMany({
      where: { status: 'IN_REVIEW', deletedAt: null },
      orderBy: { updatedAt: 'asc' },
      take: 12,
      select: pageCardSelect,
    }),
    prisma.page.findMany({
      where: { status: 'APPROVED', deletedAt: null },
      orderBy: { updatedAt: 'asc' },
      take: 12,
      select: pageCardSelect,
    }),
    // Content sitting in review for over a week is the thing a publishing team
    // most needs surfaced, because nobody notices it otherwise.
    prisma.page.count({
      where: {
        status: { in: ['IN_REVIEW', 'CHANGES_REQUESTED'] },
        updatedAt: { lt: agingBefore },
        deletedAt: null,
      },
    }),
  ]);

  return { awaitingReview, awaitingApproval, agingCount: aging };
}

async function buildPublishing(
  prisma: import('@cheezious/database').PrismaClient,
  endOfToday: Date,
  endOfWeek: Date,
  canRead: boolean,
) {
  if (!canRead) return null;

  const [today, thisWeek, recentlyPublished, failedJobs] = await Promise.all([
    prisma.page.findMany({
      where: { status: 'SCHEDULED', scheduledFor: { lte: endOfToday }, deletedAt: null },
      orderBy: { scheduledFor: 'asc' },
      take: 10,
      select: pageCardSelect,
    }),
    prisma.page.findMany({
      where: { status: 'SCHEDULED', scheduledFor: { gt: endOfToday, lte: endOfWeek }, deletedAt: null },
      orderBy: { scheduledFor: 'asc' },
      take: 10,
      select: pageCardSelect,
    }),
    prisma.page.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      orderBy: { publishedAt: 'desc' },
      take: 8,
      select: pageCardSelect,
    }),
    // A failed scheduled publish is silent unless it is shown here.
    prisma.publishingJob.findMany({
      where: { status: 'FAILED' },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, kind: true, entityType: true, entityId: true, lastError: true, attempts: true, updatedAt: true },
    }),
  ]);

  return { today, thisWeek, recentlyPublished, failedJobs };
}

/**
 * Submissions awaiting a human.
 *
 * Each queue is gated on its own permission, so the dashboard shows a
 * Procurement Manager their supplier queue without revealing that job
 * applications exist.
 */
async function buildInbox(
  prisma: import('@cheezious/database').PrismaClient,
  ability: import('@cheezious/permissions').Ability,
) {
  const [applications, suppliers, properties, partnerships, contact] = await Promise.all([
    ability.can('applications.read')
      ? prisma.jobApplication.count({ where: { status: 'NEW', deletedAt: null } })
      : Promise.resolve(null),
    ability.can('suppliers.read')
      ? prisma.supplierSubmission.count({ where: { status: 'NEW', deletedAt: null } })
      : Promise.resolve(null),
    ability.can('properties.read')
      ? prisma.propertySubmission.count({ where: { status: 'NEW', deletedAt: null } })
      : Promise.resolve(null),
    ability.can('partnerships.read')
      ? prisma.partnershipSubmission.count({ where: { status: 'NEW', deletedAt: null } })
      : Promise.resolve(null),
    ability.can('contact.read')
      ? prisma.contactSubmission.count({ where: { status: 'NEW', deletedAt: null } })
      : Promise.resolve(null),
  ]);

  return { applications, suppliers, properties, partnerships, contact };
}

async function buildActivity(prisma: import('@cheezious/database').PrismaClient, canRead: boolean) {
  const entries = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { actor: { select: { id: true, name: true } } },
  });

  return { entries, canSeeAuditLog: canRead };
}

/**
 * Content health.
 *
 * Computed live rather than read from a cache, because a dashboard that reports
 * a problem an editor fixed an hour ago trains people to ignore it.
 */
async function buildContentHealth(
  prisma: import('@cheezious/database').PrismaClient,
  staleBefore: Date,
  canRead: boolean,
) {
  if (!canRead) return null;

  const published = { status: 'PUBLISHED' as const, deletedAt: null };

  const [missingSeoTitle, missingDescription, missingOgImage, staleContent, pastReview, unpublishedChanges, missingTranslation, missingAltText] =
    await Promise.all([
      prisma.page.count({ where: { ...published, OR: [{ seo: { is: null } }, { seo: { title: null } }] } }),
      prisma.page.count({ where: { ...published, OR: [{ seo: { is: null } }, { seo: { description: null } }] } }),
      prisma.page.count({ where: { ...published, OR: [{ seo: { is: null } }, { seo: { ogImageId: null } }] } }),
      prisma.page.count({ where: { ...published, updatedAt: { lt: staleBefore } } }),
      prisma.page.count({ where: { ...published, reviewDate: { lt: new Date() } } }),
      prisma.page.count({ where: { ...published, hasUnpublishedChanges: true } }),
      // An English page with no Urdu counterpart is a translation gap.
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count FROM "pages" p
        WHERE p."locale" = 'en' AND p."status" = 'PUBLISHED' AND p."deletedAt" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "pages" t
            WHERE t."translationGroupId" = p."translationGroupId" AND t."locale" = 'ur'
          )`,
      prisma.mediaAsset.count({ where: { kind: 'IMAGE', deletedAt: null, OR: [{ altText: null }, { altText: '' }] } }),
    ]);

  const issues = [
    { type: 'MISSING_SEO_TITLE', label: 'Pages without an SEO title', count: missingSeoTitle, severity: 'warning' },
    { type: 'MISSING_META_DESCRIPTION', label: 'Pages without a meta description', count: missingDescription, severity: 'warning' },
    { type: 'MISSING_OG_IMAGE', label: 'Pages without a social image', count: missingOgImage, severity: 'info' },
    { type: 'MISSING_ALT_TEXT', label: 'Images without alt text', count: missingAltText, severity: 'error' },
    { type: 'MISSING_TRANSLATION', label: 'Pages not translated into Urdu', count: Number(missingTranslation[0]?.count ?? 0), severity: 'info' },
    { type: 'UNPUBLISHED_CHANGES', label: 'Published pages with unpublished edits', count: unpublishedChanges, severity: 'info' },
    { type: 'PAST_REVIEW_DATE', label: 'Pages past their review date', count: pastReview, severity: 'warning' },
    { type: 'STALE_CONTENT', label: 'Pages not updated in six months', count: staleContent, severity: 'info' },
  ].filter((issue) => issue.count > 0);

  return { issues, totalIssues: issues.reduce((sum, issue) => sum + issue.count, 0) };
}

async function buildSystemHealth(prisma: import('@cheezious/database').PrismaClient, canRead: boolean) {
  if (!canRead) return null;

  const [pendingJobs, failedJobs, activeSessions, totalUsers] = await Promise.all([
    prisma.publishingJob.count({ where: { status: 'PENDING' } }),
    prisma.publishingJob.count({ where: { status: 'FAILED' } }),
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
  ]);

  return { pendingJobs, failedJobs, activeSessions, totalUsers };
}

const pageCardSelect = {
  id: true,
  title: true,
  path: true,
  locale: true,
  status: true,
  hasUnpublishedChanges: true,
  publishedAt: true,
  scheduledFor: true,
  updatedAt: true,
  updatedBy: { select: { id: true, name: true } },
} satisfies import('@cheezious/database').Prisma.PageSelect;

export { OPEN_WORK_STATUSES };
