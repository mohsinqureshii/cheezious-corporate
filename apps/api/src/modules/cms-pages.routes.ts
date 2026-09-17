import { PAGINATION } from '@cheezious/config';
import { Prisma, type Locale } from '@cheezious/database';
import { signPreviewPayload } from '@cheezious/auth';
import { STATUS_META, availableTransitions, type ContentStatus, type WorkflowAction } from '@cheezious/permissions';
import { normalizePath, slugify } from '@cheezious/utilities';
import { ApiError, sanitizeHtml } from '@cheezious/validation';
import { Router } from 'express';
import { z } from 'zod';

import { AuditService } from '../lib/audit';
import { asyncHandler, clientIp, param, rateLimit, requireAuth, requirePermission } from '../middleware';
import { PageService, PAGE_INCLUDE } from '../services/pages';
import { SearchService } from '../services/search';
import { VersioningService } from '../services/versioning';
import { WorkflowService } from '../services/workflow';

/**
 * CMS page management.
 *
 * Every mutating route is permission-checked server-side. The CMS also hides
 * controls a user cannot use, but that is a courtesy — this is the boundary that
 * actually enforces who can publish.
 */

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(PAGINATION.cmsDefaultPageSize),
  q: z.string().max(200).optional(),
  status: z.string().max(200).optional(),
  locale: z.enum(['en', 'ur']).optional(),
  type: z.string().max(40).optional(),
  authorId: z.string().cuid().optional(),
  hasUnpublishedChanges: z.coerce.boolean().optional(),
  sortBy: z.enum(['updatedAt', 'title', 'path', 'publishedAt', 'status']).default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

const blockInput = z.object({
  blockKey: z.string().min(1).max(64),
  data: z.record(z.unknown()),
  isHidden: z.boolean().optional(),
  label: z.string().max(120).optional(),
  anchor: z.string().max(64).optional(),
});

const seoInput = z.object({
  title: z.string().max(200).nullish(),
  description: z.string().max(400).nullish(),
  canonicalUrl: z.string().url().nullish().or(z.literal('')),
  noindex: z.boolean().optional(),
  nofollow: z.boolean().optional(),
  ogTitle: z.string().max(200).nullish(),
  ogDescription: z.string().max(400).nullish(),
  ogImageId: z.string().cuid().nullish(),
  twitterCard: z.string().max(40).nullish(),
  keywords: z.array(z.string().max(60)).max(20).optional(),
  changeFrequency: z.string().max(20).nullish(),
  priority: z.number().min(0).max(1).nullish(),
});

const createPageInput = z.object({
  title: z.string().min(1).max(200),
  path: z.string().min(1).max(512),
  locale: z.enum(['en', 'ur']).default('en'),
  type: z.enum(['STANDARD', 'LANDING', 'SECTION_INDEX', 'EDITORIAL', 'DOCUMENT_CENTRE', 'CONTACT', 'SYSTEM']).default('STANDARD'),
  navLabel: z.string().max(120).nullish(),
  summary: z.string().max(600).nullish(),
  parentId: z.string().cuid().nullish(),
  /** Links this page to an existing page as its translation. */
  translationOfId: z.string().cuid().nullish(),
});

const updatePageInput = z.object({
  title: z.string().min(1).max(200).optional(),
  path: z.string().min(1).max(512).optional(),
  navLabel: z.string().max(120).nullish(),
  summary: z.string().max(600).nullish(),
  type: z.enum(['STANDARD', 'LANDING', 'SECTION_INDEX', 'EDITORIAL', 'DOCUMENT_CENTRE', 'CONTACT', 'SYSTEM']).optional(),
  parentId: z.string().cuid().nullish(),
  sortOrder: z.number().int().min(0).optional(),
  excludeFromSearch: z.boolean().optional(),
  excludeFromSitemap: z.boolean().optional(),
  reviewDate: z.coerce.date().nullish(),
  contentOwnerId: z.string().cuid().nullish(),
  blocks: z.array(blockInput).max(80).optional(),
  seo: seoInput.optional(),
  /** When changing a published path, whether to leave a redirect behind. */
  createRedirect: z.boolean().default(true),
});

export function cmsPagesRoutes(): Router {
  const router = Router();
  router.use(requireAuth());

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  router.get(
    '/',
    requirePermission('pages.read'),
    asyncHandler(async (req, res) => {
      const query = listQuery.parse(req.query);

      const where: Prisma.PageWhereInput = {
        deletedAt: null,
        ...(query.locale ? { locale: query.locale } : {}),
        ...(query.type ? { type: query.type as never } : {}),
        ...(query.authorId ? { createdById: query.authorId } : {}),
        ...(query.hasUnpublishedChanges ? { hasUnpublishedChanges: true } : {}),
        ...(query.status ? { status: { in: query.status.split(',') as ContentStatus[] } } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { path: { contains: query.q, mode: 'insensitive' } },
                { summary: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [items, total, statusCounts] = await Promise.all([
        req.ctx.prisma.page.findMany({
          where,
          orderBy: { [query.sortBy]: query.sortDir },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            id: true,
            title: true,
            path: true,
            type: true,
            locale: true,
            status: true,
            translationStatus: true,
            hasUnpublishedChanges: true,
            publishedAt: true,
            scheduledFor: true,
            reviewDate: true,
            updatedAt: true,
            createdBy: { select: { id: true, name: true } },
            updatedBy: { select: { id: true, name: true } },
          },
        }),
        req.ctx.prisma.page.count({ where }),
        // Status counts drive the filter chips, and are computed over the whole
        // collection rather than the current page.
        req.ctx.prisma.page.groupBy({
          by: ['status'],
          where: { deletedAt: null, ...(query.locale ? { locale: query.locale } : {}) },
          _count: true,
        }),
      ]);

      res.json({
        items,
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
        facets: {
          statuses: statusCounts.map((row) => ({
            value: row.status,
            label: STATUS_META[row.status as ContentStatus]?.label ?? row.status,
            count: row._count,
          })),
        },
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  router.get(
    '/:id',
    requirePermission('pages.read'),
    asyncHandler(async (req, res) => {
      const page = await req.ctx.prisma.page.findFirst({
        where: { id: param(req, 'id'), deletedAt: null },
        include: PAGE_INCLUDE,
      });
      if (!page) throw ApiError.notFound('Page');

      const [versions, workflowEvents, translations] = await Promise.all([
        new VersioningService(req.ctx.prisma).listVersions('page', page.id, 20),
        req.ctx.prisma.workflowEvent.findMany({
          where: { entityType: 'page', entityId: page.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        req.ctx.prisma.page.findMany({
          where: { translationGroupId: page.translationGroupId, NOT: { id: page.id } },
          select: { id: true, locale: true, path: true, status: true, translationStatus: true },
        }),
      ]);

      // Only the transitions this user can actually perform are offered, so the
      // editor never sees a button that will refuse them.
      const transitions = availableTransitions(page.status as ContentStatus, 'pages', (permission) =>
        req.ability.can(permission),
      );

      res.json({ page, versions, workflowEvents, translations, availableTransitions: transitions });
    }),
  );

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  router.post(
    '/',
    requirePermission('pages.create'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = createPageInput.parse(req.body);
      const pages = new PageService(req.ctx.prisma);

      const path = normalizePath(input.path);
      await pages.assertPathAvailable(input.locale as Locale, path);

      // A translation shares its source's group id, which is what links the
      // locale variants together for hreflang and the translation dashboard.
      let translationGroupId = `page-${slugify(path) || 'root'}-${Date.now()}`;
      if (input.translationOfId) {
        const source = await req.ctx.prisma.page.findUnique({
          where: { id: input.translationOfId },
          select: { translationGroupId: true, locale: true },
        });
        if (!source) throw ApiError.notFound('Source page');
        if (source.locale === input.locale) {
          throw ApiError.conflict('That page is already in this language.');
        }
        translationGroupId = source.translationGroupId;
      }

      const page = await req.ctx.prisma.page.create({
        data: {
          translationGroupId,
          locale: input.locale,
          path,
          slug: path.split('/').filter(Boolean).pop() ?? 'page',
          title: input.title,
          navLabel: input.navLabel ?? null,
          summary: input.summary ?? null,
          type: input.type as never,
          parentId: input.parentId ?? null,
          status: 'DRAFT',
          translationStatus: input.translationOfId ? 'IN_PROGRESS' : 'NOT_STARTED',
          hasUnpublishedChanges: true,
          createdById: req.principal!.id,
          updatedById: req.principal!.id,
          seo: { create: { title: input.title, description: input.summary ?? null } },
        },
        include: PAGE_INCLUDE,
      });

      const audit = new AuditService(req.ctx.prisma);
      await audit.record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'CREATE',
          entityType: 'page',
          entityId: page.id,
          entityLabel: page.title,
          summary: `Created page at ${page.path}`,
          after: { title: page.title, path: page.path, type: page.type },
        },
      );
      await audit.activity(req.principal!.id, 'created', 'page', page.id, page.title, `/content/pages/${page.id}`);

      res.status(201).json({ page });
    }),
  );

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  router.patch(
    '/:id',
    requirePermission('pages.update'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = updatePageInput.parse(req.body);
      const pages = new PageService(req.ctx.prisma);

      const existing = await req.ctx.prisma.page.findFirst({
        where: { id: param(req, 'id'), deletedAt: null },
        include: { seo: true },
      });
      if (!existing) throw ApiError.notFound('Page');

      const newPath = input.path ? normalizePath(input.path) : existing.path;
      if (newPath !== existing.path) {
        await pages.assertPathAvailable(existing.locale, newPath, existing.id);
      }

      const updated = await req.ctx.prisma.$transaction(async (tx) => {
        // A published page changing path leaves a redirect behind, so links
        // shared before the rename keep working.
        if (newPath !== existing.path) {
          await pages.recordPathChange(
            {
              pageId: existing.id,
              locale: existing.locale,
              oldPath: existing.path,
              newPath,
              wasPublished: existing.status === 'PUBLISHED' || existing.firstPublishedAt !== null,
              actorId: req.principal!.id,
              createRedirect: input.createRedirect,
            },
            tx,
          );
        }

        await tx.page.update({
          where: { id: existing.id },
          data: {
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.path !== undefined
              ? { path: newPath, slug: newPath.split('/').filter(Boolean).pop() ?? existing.slug }
              : {}),
            ...(input.navLabel !== undefined ? { navLabel: input.navLabel } : {}),
            ...(input.summary !== undefined ? { summary: input.summary } : {}),
            ...(input.type !== undefined ? { type: input.type as never } : {}),
            ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
            ...(input.excludeFromSearch !== undefined ? { excludeFromSearch: input.excludeFromSearch } : {}),
            ...(input.excludeFromSitemap !== undefined ? { excludeFromSitemap: input.excludeFromSitemap } : {}),
            ...(input.reviewDate !== undefined ? { reviewDate: input.reviewDate } : {}),
            ...(input.contentOwnerId !== undefined ? { contentOwnerId: input.contentOwnerId } : {}),
            updatedById: req.principal!.id,
          },
        });

        if (input.blocks) {
          await pages.replaceBlocks(existing.id, input.blocks, tx);
        }

        if (input.seo) {
          // Typed explicitly rather than cast, so adding an SEO field to the
          // schema without adding it here is a compile error, not a silent
          // field that never saves.
          const seoData: Prisma.PageSeoUncheckedUpdateInput = {
            ...input.seo,
            canonicalUrl: input.seo.canonicalUrl === '' ? null : input.seo.canonicalUrl,
          };
          await tx.pageSeo.upsert({
            where: { pageId: existing.id },
            create: { ...(seoData as Prisma.PageSeoUncheckedCreateInput), pageId: existing.id },
            update: seoData,
          });
        }

        return tx.page.findUniqueOrThrow({ where: { id: existing.id }, include: PAGE_INCLUDE });
      });

      // Recomputed after the write so the CMS can tell the editor their changes
      // are not live yet.
      const hasUnpublishedChanges = await pages.refreshUnpublishedFlag(existing.id);

      const audit = new AuditService(req.ctx.prisma);
      await audit.record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'UPDATE',
          entityType: 'page',
          entityId: existing.id,
          entityLabel: updated.title,
          summary: newPath !== existing.path ? `Moved from ${existing.path} to ${newPath}` : 'Updated page',
          before: { title: existing.title, path: existing.path, summary: existing.summary },
          after: { title: updated.title, path: updated.path, summary: updated.summary },
        },
      );

      res.json({ page: { ...updated, hasUnpublishedChanges } });
    }),
  );

  // ---------------------------------------------------------------------------
  // Workflow transitions
  // ---------------------------------------------------------------------------

  const transitionInput = z.object({
    action: z.enum([
      'SUBMIT_FOR_REVIEW',
      'REQUEST_CHANGES',
      'APPROVE',
      'PUBLISH',
      'SCHEDULE',
      'CANCEL_SCHEDULE',
      'UNPUBLISH',
      'ARCHIVE',
      'RESTORE_TO_DRAFT',
    ]),
    scheduledFor: z.coerce.date().optional(),
    note: z.string().max(2000).optional(),
  });

  router.post(
    '/:id/transition',
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = transitionInput.parse(req.body);

      const page = await req.ctx.prisma.page.findFirst({
        where: { id: param(req, 'id'), deletedAt: null },
        select: {
          id: true,
          title: true,
          path: true,
          locale: true,
          status: true,
          createdById: true,
          firstPublishedAt: true,
          excludeFromSearch: true,
        },
      });
      if (!page) throw ApiError.notFound('Page');

      const workflow = new WorkflowService(req.ctx.prisma);
      const pages = new PageService(req.ctx.prisma);
      const snapshot = await pages.buildSnapshot(page.id);

      const request = {
        entityType: 'page',
        entityId: page.id,
        action: input.action as WorkflowAction,
        currentStatus: page.status as ContentStatus,
        scheduledFor: input.scheduledFor ?? null,
        note: input.note ?? null,
        snapshot,
        entityLabel: page.title,
      };

      // Validated before the transaction opens: an illegal transition or a
      // missing permission costs nothing and produces a precise message.
      workflow.assertAllowed(request, req.ability);

      const actor = { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) };

      const outcome = await req.ctx.prisma.$transaction(async (tx) => {
        const result = await workflow.apply(request, actor, tx, {
          wasEverPublished: page.firstPublishedAt !== null,
        });

        await tx.page.update({
          where: { id: page.id },
          data: {
            status: result.status,
            ...(result.publishedVersionId !== undefined
              ? { publishedVersionId: result.publishedVersionId, hasUnpublishedChanges: false }
              : {}),
            ...(result.publishedAt !== undefined ? { publishedAt: result.publishedAt } : {}),
            ...(result.scheduledFor !== undefined ? { scheduledFor: result.scheduledFor } : {}),
            ...(result.firstPublish ? { firstPublishedAt: new Date() } : {}),
            ...(input.action === 'PUBLISH' ? { publishedById: req.principal!.id } : {}),
          },
        });

        await workflow.notify(request, result.status, req.principal!.id, tx, {
          authorId: page.createdById,
          reviewerIds: await reviewerIdsFor(tx),
        });

        return result;
      });

      // Search indexing follows the published state. Kept outside the
      // transaction: a search-index failure must not roll back a publish.
      await syncSearchIndex(req.ctx.prisma, page, outcome.status);

      res.json({ status: outcome.status, scheduledFor: outcome.scheduledFor ?? null });
    }),
  );

  // ---------------------------------------------------------------------------
  // Versions
  // ---------------------------------------------------------------------------

  router.get(
    '/:id/versions',
    requirePermission('pages.read'),
    asyncHandler(async (req, res) => {
      res.json({ versions: await new VersioningService(req.ctx.prisma).listVersions('page', param(req, 'id'), 50) });
    }),
  );

  router.get(
    '/:id/versions/diff',
    requirePermission('pages.read'),
    asyncHandler(async (req, res) => {
      const { from, to } = z.object({ from: z.string().cuid(), to: z.string().cuid() }).parse(req.query);
      res.json(await new VersioningService(req.ctx.prisma).diff(from, to));
    }),
  );

  /**
   * Restore an earlier version.
   *
   * Restoring appends rather than overwrites: the current state is captured as a
   * version first, so "undo the restore" is always possible.
   */
  router.post(
    '/:id/versions/:versionId/restore',
    requirePermission('pages.restore'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const versioning = new VersioningService(req.ctx.prisma);
      const pages = new PageService(req.ctx.prisma);

      const page = await req.ctx.prisma.page.findFirst({
        where: { id: param(req, 'id'), deletedAt: null },
        select: { id: true, title: true, status: true, locale: true, path: true },
      });
      if (!page) throw ApiError.notFound('Page');

      const version = await versioning.getVersion(param(req, 'versionId'));
      if (version.entityType !== 'page' || version.entityId !== page.id) {
        throw ApiError.conflict('That version belongs to different content.');
      }

      const data = version.data as Record<string, unknown>;

      await req.ctx.prisma.$transaction(async (tx) => {
        // Capture the current state before overwriting it.
        await versioning.createVersion(
          {
            entityType: 'page',
            entityId: page.id,
            data: await pages.buildSnapshot(page.id, tx),
            status: page.status as ContentStatus,
            createdById: req.principal!.id,
            note: `State before restoring version ${version.versionNumber}`,
          },
          tx,
        );

        await tx.page.update({
          where: { id: page.id },
          data: {
            title: (data.title as string) ?? page.title,
            navLabel: (data.navLabel as string) ?? null,
            summary: (data.summary as string) ?? null,
            updatedById: req.principal!.id,
          },
        });

        const blocks = (data.blocks as Array<{ blockKey: string; data: Record<string, unknown> }>) ?? [];
        await pages.replaceBlocks(page.id, blocks, tx);

        // The snapshot's SEO block is restored wholesale. `id` and `pageId` are
        // dropped: a version must not be able to re-point a row at another page.
        const snapshotSeo = data.seo as Record<string, unknown> | null;
        if (snapshotSeo) {
          const { id: _id, pageId: _pageId, ...seoFields } = snapshotSeo;
          const seoData = seoFields as Prisma.PageSeoUncheckedUpdateInput;

          await tx.pageSeo.upsert({
            where: { pageId: page.id },
            create: { ...(seoData as Prisma.PageSeoUncheckedCreateInput), pageId: page.id },
            update: seoData,
          });
        }

        await versioning.createVersion(
          {
            entityType: 'page',
            entityId: page.id,
            data,
            status: page.status as ContentStatus,
            createdById: req.principal!.id,
            note: `Restored from version ${version.versionNumber}`,
            restoredFromVersionId: version.id,
          },
          tx,
        );
      });

      await pages.refreshUnpublishedFlag(page.id);

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'RESTORE',
          entityType: 'page',
          entityId: page.id,
          entityLabel: page.title,
          summary: `Restored version ${version.versionNumber}`,
        },
      );

      res.json({
        ok: true,
        message: `Restored version ${version.versionNumber}. The previous state was saved as a new version.`,
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Preview
  // ---------------------------------------------------------------------------

  /** Issue a short-lived signed preview link for unpublished content. */
  router.post(
    '/:id/preview',
    requirePermission('pages.read'),
    asyncHandler(async (req, res) => {
      const page = await req.ctx.prisma.page.findFirst({
        where: { id: param(req, 'id'), deletedAt: null },
        select: { id: true, locale: true, path: true },
      });
      if (!page) throw ApiError.notFound('Page');

      // Thirty minutes: long enough to review a page, short enough that a link
      // pasted into a chat does not stay a hole in the publishing model.
      const expiresAt = Date.now() + 30 * 60 * 1000;
      const token = signPreviewPayload(
        { entityType: 'page', entityId: page.id, locale: page.locale, expiresAt },
        req.ctx.env.PREVIEW_SECRET,
      );

      res.json({
        url: `${req.ctx.env.CORPORATE_WEB_URL}/${page.locale}${page.path}?preview=${encodeURIComponent(token)}`,
        expiresAt: new Date(expiresAt),
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Delete (soft)
  // ---------------------------------------------------------------------------

  router.delete(
    '/:id',
    requirePermission('pages.delete'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const page = await req.ctx.prisma.page.findFirst({
        where: { id: param(req, 'id'), deletedAt: null },
        select: { id: true, title: true, path: true, locale: true, status: true },
      });
      if (!page) throw ApiError.notFound('Page');

      // Soft delete: institutional history is never destroyed by a click, and
      // the page can be restored.
      await req.ctx.prisma.page.update({
        where: { id: page.id },
        data: { deletedAt: new Date(), status: 'ARCHIVED', updatedById: req.principal!.id },
      });

      await new SearchService(req.ctx.prisma).remove('PAGE', page.id, page.locale);

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'DELETE',
          entityType: 'page',
          entityId: page.id,
          entityLabel: page.title,
          summary: `Deleted page at ${page.path}`,
        },
      );

      res.json({ ok: true, message: 'Page deleted. It can be restored from the archive.' });
    }),
  );

  return router;
}

/** Users who can review submitted content, for review notifications. */
async function reviewerIdsFor(tx: Prisma.TransactionClient): Promise<string[]> {
  const users = await tx.user.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      roles: { some: { role: { permissions: { some: { permission: { key: 'pages.publish' } } } } } },
    },
    select: { id: true },
    take: 20,
  });
  return users.map((user) => user.id);
}

/** Keep the public search index consistent with the published state. */
async function syncSearchIndex(
  prisma: import('@cheezious/database').PrismaClient,
  page: { id: string; title: string; path: string; locale: Locale; excludeFromSearch: boolean },
  status: ContentStatus,
): Promise<void> {
  const search = new SearchService(prisma);

  if (status !== 'PUBLISHED' || page.excludeFromSearch) {
    await search.remove('PAGE', page.id, page.locale).catch(() => undefined);
    return;
  }

  try {
    const full = await prisma.page.findUnique({
      where: { id: page.id },
      include: { blocks: { where: { isHidden: false }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!full) return;

    const { extractTextFromBlocks } = await import('@cheezious/page-builder');
    const body = extractTextFromBlocks(
      full.blocks.map((block) => ({ blockKey: block.blockKey, data: block.data as Record<string, unknown> })),
    );

    await search.index({
      type: 'PAGE',
      entityId: page.id,
      locale: page.locale,
      title: full.title,
      summary: full.summary,
      body: sanitizeHtml(body),
      url: `/${page.locale}${full.path}`,
      section: full.path.split('/')[2] ?? 'company',
      publishedAt: full.publishedAt,
    });
  } catch {
    // Indexing is best-effort: a publish must succeed even if search is down.
  }
}
