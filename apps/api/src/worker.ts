import { apiSchema, parseEnv } from '@cheezious/config';
import { createPrismaClient, type Prisma } from '@cheezious/database';
import { createLogger } from '@cheezious/logger';
import { extractTextFromBlocks } from '@cheezious/page-builder';
import { sanitizeHtml } from '@cheezious/validation';

import { RevalidationService } from './services/revalidation';
import { SearchService } from './services/search';

/**
 * The background worker.
 *
 * Three things happen here that must not happen inside a web request: scheduled
 * content is published at the time it was promised, the search index is rebuilt,
 * and the site is scanned for the problems nobody notices until a visitor does.
 *
 * Design notes worth stating, because each one is a decision rather than an
 * accident:
 *
 *   - **Jobs are claimed, not selected.** A claim is a conditional update on the
 *     row, so two workers racing for the same job produce one winner and one
 *     no-op. That makes it safe to run more than one worker without a lock
 *     service.
 *
 *   - **A publish is the same code path as a publish from the CMS.** The
 *     scheduled publish writes the same version snapshot and moves the same
 *     status, so content published at 6am by the worker is indistinguishable
 *     from content published at 6am by a person. A separate path would drift.
 *
 *   - **Failures retry with backoff and then stop.** A job that has failed its
 *     attempts stays FAILED and is surfaced on the Scheduled screen, because a
 *     publish that silently never happened is worse than one that visibly did
 *     not.
 *
 *   - **The loop is polling, deliberately.** Postgres LISTEN/NOTIFY would be
 *     lower latency, but publishing to the minute is the requirement, and a
 *     poll survives a dropped connection without any reconnection logic to get
 *     wrong.
 */

const env = parseEnv(apiSchema);
const logger = createLogger({ name: 'cheezious-worker', level: env.LOG_LEVEL });
const prisma = createPrismaClient();

/** How often to look for work. Publishing is promised to the minute. */
const POLL_INTERVAL_MS = 15_000;
/** How often to scan the site for content-health problems. */
const HEALTH_SCAN_INTERVAL_MS = 60 * 60 * 1000;
/** Retry delays by attempt number. A transient failure should not need a human. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000];

let running = true;
let inFlight: Promise<unknown> = Promise.resolve();

async function main(): Promise<void> {
  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, 'worker started');

  let lastHealthScan = 0;

  while (running) {
    try {
      inFlight = drainJobs();
      await inFlight;

      // Content beyond its unpublish date comes down without a job, because
      // nothing enqueues one when the date is set directly on the record.
      await unpublishExpiredContent();

      if (Date.now() - lastHealthScan > HEALTH_SCAN_INTERVAL_MS) {
        lastHealthScan = Date.now();
        inFlight = scanContentHealth();
        await inFlight;
      }
    } catch (error) {
      // The loop must survive anything: a worker that exits on a transient
      // database error stops publishing until somebody notices.
      logger.error({ err: error }, 'worker iteration failed');
    }

    await sleep(POLL_INTERVAL_MS);
  }

  logger.info('worker stopped');
}

// ---------------------------------------------------------------------------
// Job queue
// ---------------------------------------------------------------------------

async function drainJobs(): Promise<void> {
  for (let processed = 0; processed < 50; processed += 1) {
    const job = await claimNextJob();
    if (!job) return;

    const startedAt = Date.now();

    try {
      await runJob(job);
      await prisma.publishingJob.update({
        where: { id: job.id },
        data: { status: 'SUCCEEDED', finishedAt: new Date(), lastError: null },
      });
      logger.info(
        {
          jobId: job.id,
          kind: job.kind,
          entityId: job.entityId,
          durationMs: Date.now() - startedAt,
        },
        'job succeeded',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const exhausted = job.attempts + 1 >= job.maxAttempts;

      await prisma.publishingJob.update({
        where: { id: job.id },
        data: exhausted
          ? { status: 'FAILED', finishedAt: new Date(), lastError: message.slice(0, 1000) }
          : {
              status: 'PENDING',
              lastError: message.slice(0, 1000),
              runAt: new Date(Date.now() + (BACKOFF_MS[job.attempts] ?? 30 * 60_000)),
            },
      });

      logger[exhausted ? 'error' : 'warn'](
        { jobId: job.id, kind: job.kind, attempts: job.attempts + 1, err: error },
        exhausted ? 'job failed permanently' : 'job failed, will retry',
      );

      if (exhausted) await notifyJobFailure(job);
    }
  }
}

/**
 * Claim one job.
 *
 * The status is part of the WHERE clause, so the update only succeeds for a
 * worker that finds the job still pending. Two workers racing produce one
 * winner and one no-op rather than a duplicate publish.
 */
async function claimNextJob() {
  const candidate = await prisma.publishingJob.findFirst({
    where: { status: 'PENDING', runAt: { lte: new Date() } },
    orderBy: { runAt: 'asc' },
    select: {
      id: true,
      kind: true,
      entityType: true,
      entityId: true,
      payload: true,
      attempts: true,
      maxAttempts: true,
    },
  });
  if (!candidate) return null;

  const claimed = await prisma.publishingJob.updateMany({
    where: { id: candidate.id, status: 'PENDING' },
    data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return null;

  return candidate;
}

type Job = NonNullable<Awaited<ReturnType<typeof claimNextJob>>>;

async function runJob(job: Job): Promise<void> {
  switch (job.kind) {
    case 'PUBLISH':
      return publishScheduled(job);
    case 'UNPUBLISH':
      return unpublishEntity(job);
    case 'REINDEX':
      return reindexAll();
    case 'CONTENT_HEALTH_SCAN':
      return scanContentHealth();
    case 'MEDIA_VARIANTS':
    case 'EXPORT':
    case 'NOTIFICATION':
      // Nothing enqueues these yet. Failing loudly beats appearing to do work.
      throw new Error(`No handler is implemented for ${job.kind} jobs.`);
    default:
      throw new Error(`Unknown job kind: ${String(job.kind)}`);
  }
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/** The entity types that can be scheduled, and where their state lives. */
const SCHEDULABLE = {
  page: { delegate: 'page', search: 'PAGE' },
  story: { delegate: 'story', search: 'STORY' },
  news: { delegate: 'story', search: 'NEWS' },
  pressRelease: { delegate: 'pressRelease', search: 'PRESS_RELEASE' },
  person: { delegate: 'person', search: 'PERSON' },
  policy: { delegate: 'policy', search: 'POLICY' },
} as const;

type Schedulable = keyof typeof SCHEDULABLE;

function delegateFor(entityType: string) {
  const config = SCHEDULABLE[entityType as Schedulable];
  if (!config) throw new Error(`${entityType} cannot be scheduled.`);
  return {
    config,
    model: (
      prisma as unknown as Record<
        string,
        {
          findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
          update: (args: unknown) => Promise<Record<string, unknown>>;
        }
      >
    )[config.delegate]!,
  };
}

async function publishScheduled(job: Job): Promise<void> {
  if (!job.entityType || !job.entityId) throw new Error('The job names no entity to publish.');

  const { config, model } = delegateFor(job.entityType);

  const record = await model.findUnique({ where: { id: job.entityId } });
  if (!record) throw new Error('The content this job was scheduled for no longer exists.');
  if (record.deletedAt) throw new Error('The content this job was scheduled for has been deleted.');

  // Someone may have published, unpublished or unscheduled it in the meantime.
  // Their decision is more recent than the schedule, so it wins.
  if (record.status !== 'SCHEDULED') {
    logger.info(
      { entityType: job.entityType, entityId: job.entityId, status: record.status },
      'scheduled publish skipped: the status changed after it was scheduled',
    );
    return;
  }

  const snapshot = await buildSnapshot(job.entityType, job.entityId);

  await prisma.$transaction(async (tx) => {
    const latest = await tx.contentVersion.findFirst({
      where: { entityType: job.entityType!, entityId: job.entityId! },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const version = await tx.contentVersion.create({
      data: {
        entityType: job.entityType!,
        entityId: job.entityId!,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        data: snapshot as Prisma.InputJsonValue,
        status: 'PUBLISHED',
        note: 'Published on schedule',
      },
    });

    const delegate = (
      tx as unknown as Record<string, { update: (args: unknown) => Promise<unknown> }>
    )[config.delegate]!;

    await delegate.update({
      where: { id: job.entityId },
      data: {
        status: 'PUBLISHED',
        publishedVersionId: version.id,
        hasUnpublishedChanges: false,
        publishedAt: new Date(),
        scheduledFor: null,
        ...(job.entityType === 'page' && record.firstPublishedAt === null
          ? { firstPublishedAt: new Date() }
          : {}),
      },
    });

    await tx.workflowEvent.create({
      data: {
        entityType: job.entityType!,
        entityId: job.entityId!,
        action: 'PUBLISH',
        fromStatus: 'SCHEDULED',
        toStatus: 'PUBLISHED',
        note: 'Published on schedule',
        actorName: 'scheduler',
      },
    });

    await tx.auditLog.create({
      data: {
        action: 'PUBLISH',
        entityType: job.entityType!,
        entityId: job.entityId!,
        entityLabel: String(record.title ?? record.name ?? record.headline ?? job.entityId),
        summary: 'Scheduled → Published',
        actorEmail: null,
      },
    });
  });

  await syncSearch(job.entityType, job.entityId, 'PUBLISHED');
  await revalidateFor(job.entityType, record);

  // The author asked for this to happen; they should not have to check.
  if (record.createdById) {
    await prisma.notification.create({
      data: {
        userId: String(record.createdById),
        kind: 'PUBLISHED',
        title: `${String(record.title ?? record.name ?? record.headline ?? 'Content')} is now live`,
        body: 'It published on the schedule you set.',
        entityType: job.entityType,
        entityId: job.entityId,
        href: `/content/${job.entityType === 'page' ? 'pages' : job.entityType}/${job.entityId}`,
      },
    });
  }
}

async function unpublishEntity(job: Job): Promise<void> {
  if (!job.entityType || !job.entityId) throw new Error('The job names no entity to unpublish.');

  const { config, model } = delegateFor(job.entityType);
  const record = await model.findUnique({ where: { id: job.entityId } });
  if (!record || record.deletedAt) return;
  if (record.status !== 'PUBLISHED') return;

  await model.update({
    where: { id: job.entityId },
    data: { status: 'UNPUBLISHED', publishedAt: null, unpublishAt: null },
  });

  await syncSearch(job.entityType, job.entityId, 'UNPUBLISHED');
  await revalidateFor(job.entityType, record);

  await prisma.workflowEvent.create({
    data: {
      entityType: job.entityType,
      entityId: job.entityId,
      action: 'UNPUBLISH',
      fromStatus: 'PUBLISHED',
      toStatus: 'UNPUBLISHED',
      note: 'Unpublished on schedule',
      actorName: 'scheduler',
    },
  });

  logger.info({ entityType: job.entityType, entityId: job.entityId }, 'unpublished on schedule');
  void config;
}

/**
 * Take down anything past its unpublish date.
 *
 * Setting `unpublishAt` on a record does not enqueue a job, so this is the thing
 * that honours it. An embargo that does not lift on time is the same failure as
 * one that never lifts.
 */
async function unpublishExpiredContent(): Promise<void> {
  const now = new Date();

  const pages = await prisma.page.findMany({
    where: { status: 'PUBLISHED', unpublishAt: { lte: now }, deletedAt: null },
    select: { id: true, title: true },
    take: 50,
  });

  for (const page of pages) {
    await prisma.page.update({
      where: { id: page.id },
      data: { status: 'UNPUBLISHED', publishedAt: null, unpublishAt: null },
    });
    await syncSearch('page', page.id, 'UNPUBLISHED');
    await revalidateFor('page', page as unknown as Record<string, unknown>);
    await prisma.auditLog.create({
      data: {
        action: 'UNPUBLISH',
        entityType: 'page',
        entityId: page.id,
        entityLabel: page.title,
        summary: 'Unpublished automatically at its unpublish date',
      },
    });
    logger.info({ pageId: page.id }, 'page unpublished at its unpublish date');
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

async function syncSearch(entityType: string, entityId: string, status: string): Promise<void> {
  const config = SCHEDULABLE[entityType as Schedulable];
  if (!config) return;

  const search = new SearchService(prisma);

  try {
    if (status !== 'PUBLISHED') {
      await search.remove(config.search as never, entityId);
      return;
    }

    if (entityType === 'page') {
      const page = await prisma.page.findUnique({
        where: { id: entityId },
        include: { blocks: { where: { isHidden: false }, orderBy: { sortOrder: 'asc' } } },
      });
      if (!page || page.excludeFromSearch) return;

      await search.index({
        type: 'PAGE',
        entityId: page.id,
        locale: page.locale,
        title: page.title,
        summary: page.summary,
        body: sanitizeHtml(
          extractTextFromBlocks(
            page.blocks.map((block) => ({
              blockKey: block.blockKey,
              data: block.data as Record<string, unknown>,
            })),
          ),
        ),
        url: page.path,
        publishedAt: page.publishedAt,
      });
      return;
    }

    if (entityType === 'story' || entityType === 'news') {
      const story = await prisma.story.findUnique({ where: { id: entityId } });
      if (!story) return;

      await search.index({
        type: story.kind === 'NEWS' ? 'NEWS' : 'STORY',
        entityId: story.id,
        locale: story.locale,
        title: story.title,
        summary: story.excerpt,
        body: story.body ?? '',
        url: `/newsroom/${story.slug}`,
        publishedAt: story.publishedAt,
      });
    }
  } catch (error) {
    // A search-index failure must never undo a publish.
    logger.warn({ err: error, entityType, entityId }, 'search index sync failed');
  }
}

/**
 * Clear the public site's cache for something the worker just published.
 *
 * The worker runs outside a request, so nothing else will do it: without this a
 * scheduled publish lands in the database at the promised minute and appears on
 * the site up to a revalidation window later, which defeats the point of
 * scheduling it.
 */
async function revalidateFor(entityType: string, record: Record<string, unknown>): Promise<void> {
  const revalidation = new RevalidationService({ env, prisma, logger } as never);

  const target =
    entityType === 'page'
      ? revalidation.page((record.locale as 'en' | 'ur') ?? 'en', String(record.path ?? '/'))
      : revalidation.collection(entityType === 'news' ? 'news' : `${entityType}s`);

  await revalidation.revalidate(target);
}

async function reindexAll(): Promise<void> {
  const search = new SearchService(prisma);

  const pages = await prisma.page.findMany({
    where: { status: 'PUBLISHED', deletedAt: null, excludeFromSearch: false },
    include: { blocks: { where: { isHidden: false }, orderBy: { sortOrder: 'asc' } } },
  });

  for (const page of pages) {
    await search.index({
      type: 'PAGE',
      entityId: page.id,
      locale: page.locale,
      title: page.title,
      summary: page.summary,
      body: sanitizeHtml(
        extractTextFromBlocks(
          page.blocks.map((block) => ({
            blockKey: block.blockKey,
            data: block.data as Record<string, unknown>,
          })),
        ),
      ),
      url: page.path,
      publishedAt: page.publishedAt,
    });
  }

  logger.info({ pages: pages.length }, 'search index rebuilt');
}

// ---------------------------------------------------------------------------
// Content health
// ---------------------------------------------------------------------------

interface DetectedIssue {
  type: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  entityType: string;
  entityId: string;
  entityLabel: string;
  locale: string;
  field?: string;
  detail?: string;
  href?: string;
}

/**
 * Scan for the problems nobody notices until a visitor does.
 *
 * Issues already dismissed stay dismissed: re-raising something a person has
 * explicitly judged acceptable is how a health screen becomes noise nobody
 * reads. Issues that no longer hold are resolved rather than deleted, so the
 * screen can say what was fixed.
 */
async function scanContentHealth(): Promise<void> {
  const issues: DetectedIssue[] = [];

  const pages = await prisma.page.findMany({
    where: { deletedAt: null, status: 'PUBLISHED' },
    select: {
      id: true,
      title: true,
      path: true,
      locale: true,
      summary: true,
      reviewDate: true,
      hasUnpublishedChanges: true,
      seo: { select: { title: true, description: true, ogImageId: true } },
      _count: { select: { blocks: true } },
    },
  });

  const now = new Date();

  for (const page of pages) {
    const href = `/content/pages/${page.id}`;
    const base = {
      entityType: 'page',
      entityId: page.id,
      entityLabel: page.title,
      locale: page.locale,
      href,
    };

    if (!page.seo?.description && !page.summary) {
      issues.push({
        ...base,
        type: 'MISSING_META_DESCRIPTION',
        severity: 'WARNING',
        field: 'seo.description',
        detail: 'Search engines will invent a description from the page content.',
      });
    }

    if (!page.seo?.ogImageId) {
      issues.push({
        ...base,
        type: 'MISSING_OG_IMAGE',
        severity: 'INFO',
        field: 'seo.ogImageId',
        detail: 'Shared links fall back to the site-wide image.',
      });
    }

    if (page._count.blocks === 0) {
      issues.push({
        ...base,
        type: 'EMPTY_REQUIRED_BLOCK',
        severity: 'ERROR',
        detail: 'This page is published with no content on it.',
      });
    }

    if (page.reviewDate && page.reviewDate < now) {
      issues.push({
        ...base,
        type: 'PAST_REVIEW_DATE',
        severity: 'WARNING',
        detail: `Due for review on ${page.reviewDate.toISOString().slice(0, 10)}.`,
      });
    }

    if (page.hasUnpublishedChanges) {
      issues.push({
        ...base,
        type: 'UNPUBLISHED_CHANGES',
        severity: 'INFO',
        detail: 'Edits are saved but not live.',
      });
    }
  }

  // Published English pages with no counterpart: live, and half the audience
  // cannot read them.
  const untranslated = await prisma.$queryRaw<Array<{ id: string; title: string; path: string }>>`
    SELECT p.id, p.title, p.path
    FROM pages p
    WHERE p.locale = 'en'
      AND p.status = 'PUBLISHED'
      AND p."deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM pages t
        WHERE t."translationGroupId" = p."translationGroupId"
          AND t.locale = 'ur'
          AND t."deletedAt" IS NULL
      )
  `;

  for (const page of untranslated) {
    issues.push({
      type: 'MISSING_TRANSLATION',
      severity: 'WARNING',
      entityType: 'page',
      entityId: page.id,
      entityLabel: page.title,
      locale: 'en',
      detail: 'Published in English with no Urdu version.',
      href: `/content/pages/${page.id}`,
    });
  }

  // Images used on published pages, with no alternative text.
  const imagesWithoutAlt = await prisma.mediaAsset.findMany({
    where: {
      deletedAt: null,
      kind: 'IMAGE',
      OR: [{ altText: null }, { altText: '' }],
      usages: { some: {} },
    },
    select: { id: true, title: true },
    take: 500,
  });

  for (const asset of imagesWithoutAlt) {
    issues.push({
      type: 'MISSING_ALT_TEXT',
      severity: 'ERROR',
      entityType: 'mediaAsset',
      entityId: asset.id,
      entityLabel: asset.title,
      locale: 'en',
      detail: 'This image is in use and announces nothing to a screen reader.',
      href: '/media?missingAltText=true',
    });
  }

  await reconcileIssues(issues);
  logger.info({ detected: issues.length }, 'content health scan complete');
}

async function reconcileIssues(detected: DetectedIssue[]): Promise<void> {
  const open = await prisma.contentHealthIssue.findMany({
    where: { resolvedAt: null },
    select: { id: true, type: true, entityType: true, entityId: true, dismissedAt: true },
  });

  const key = (issue: { type: string; entityType: string; entityId: string }) =>
    `${issue.type}:${issue.entityType}:${issue.entityId}`;

  const detectedKeys = new Set(detected.map(key));
  const openByKey = new Map(open.map((issue) => [key(issue), issue]));

  const created: Prisma.ContentHealthIssueCreateManyInput[] = [];
  for (const issue of detected) {
    if (openByKey.has(key(issue))) continue;
    created.push({
      type: issue.type as never,
      severity: issue.severity,
      entityType: issue.entityType,
      entityId: issue.entityId,
      entityLabel: issue.entityLabel,
      locale: issue.locale as never,
      field: issue.field ?? null,
      detail: issue.detail ?? null,
      href: issue.href ?? null,
    });
  }

  if (created.length > 0) {
    await prisma.contentHealthIssue.createMany({ data: created });
  }

  // Anything no longer detected has been fixed.
  const resolved = open.filter((issue) => !detectedKeys.has(key(issue))).map((issue) => issue.id);
  if (resolved.length > 0) {
    await prisma.contentHealthIssue.updateMany({
      where: { id: { in: resolved } },
      data: { resolvedAt: new Date() },
    });
  }

  logger.info(
    { created: created.length, resolved: resolved.length },
    'content health issues reconciled',
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The working copy, as it will be served once published. */
async function buildSnapshot(
  entityType: string,
  entityId: string,
): Promise<Record<string, unknown>> {
  if (entityType === 'page') {
    const page = await prisma.page.findUnique({
      where: { id: entityId },
      include: {
        blocks: { orderBy: { sortOrder: 'asc' } },
        seo: true,
      },
    });
    if (!page) throw new Error('Page not found while building its snapshot.');

    const { blocks, seo, ...rest } = page;
    return {
      ...rest,
      blocks: blocks.map((block) => ({
        blockKey: block.blockKey,
        data: block.data,
        isHidden: block.isHidden,
        anchor: block.anchor,
        label: block.label,
        sortOrder: block.sortOrder,
      })),
      seo,
    } as Record<string, unknown>;
  }

  const { model } = delegateFor(entityType);
  const record = await model.findUnique({ where: { id: entityId } });
  if (!record) throw new Error('Content not found while building its snapshot.');
  return record;
}

/** Tell the people who can act on a failed publish that it failed. */
async function notifyJobFailure(job: Job): Promise<void> {
  if (!job.entityId) return;

  const publishers = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      roles: {
        some: { role: { permissions: { some: { permission: { key: 'pages.publish' } } } } },
      },
    },
    select: { id: true },
    take: 10,
  });

  if (publishers.length === 0) return;

  await prisma.notification.createMany({
    data: publishers.map((user) => ({
      userId: user.id,
      kind: 'PUBLISH_FAILED' as const,
      title: 'A scheduled publish failed',
      body: 'It did not go live. Open it and publish it by hand, or reschedule it.',
      entityType: job.entityType,
      entityId: job.entityId,
      href: '/scheduled',
    })),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker shutting down');
  running = false;

  // Let the job in flight finish rather than leaving it RUNNING forever.
  await Promise.race([inFlight, sleep(30_000)]);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection in worker');
});

main().catch(async (error) => {
  logger.fatal({ err: error }, 'worker failed to start');
  await prisma.$disconnect();
  process.exit(1);
});
