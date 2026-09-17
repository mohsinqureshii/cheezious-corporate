import { PAGINATION } from '@cheezious/config';
import type { Prisma } from '@cheezious/database';
import { normalizePath } from '@cheezious/utilities';
import { ApiError } from '@cheezious/validation';
import { Router } from 'express';
import { z } from 'zod';

import { AuditService } from '../lib/audit';
import { asyncHandler, clientIp, param, rateLimit, requireAuth, requirePermission } from '../middleware';

/**
 * Site structure and operations.
 *
 * The parts of the platform that are not content but decide how content is
 * reached: navigation, the footer, redirects, forms, translation status,
 * content health and integrations.
 *
 * These share a module because they share a property — each one is small,
 * global, and capable of breaking the whole site if it is wrong. A redirect
 * loop, a navigation item pointing at a deleted page and a disabled locale are
 * all outages of a kind, so each write here validates against that rather than
 * trusting the caller.
 */

const REDIRECT_STATUS = [301, 302, 307, 308] as const;

export function cmsStructureRoutes(): Router {
  const router = Router();
  router.use(requireAuth());

  // ===========================================================================
  // Navigation
  // ===========================================================================

  router.get(
    '/navigation',
    requirePermission('navigation.manage'),
    asyncHandler(async (req, res) => {
      const query = z
        .object({ locale: z.enum(['en', 'ur']).optional(), location: z.string().max(40).optional() })
        .parse(req.query);

      const navigations = await req.ctx.prisma.navigation.findMany({
        where: {
          ...(query.locale ? { locale: query.locale } : {}),
          ...(query.location ? { location: query.location as never } : {}),
        },
        orderBy: [{ locale: 'asc' }, { location: 'asc' }],
        include: {
          items: {
            orderBy: [{ sortOrder: 'asc' }],
            select: {
              id: true,
              kind: true,
              label: true,
              descriptor: true,
              pageId: true,
              externalUrl: true,
              opensInNewTab: true,
              isCallToAction: true,
              parentId: true,
              sortOrder: true,
              isVisible: true,
              featuredEyebrow: true,
              featuredHeadline: true,
              page: { select: { id: true, title: true, path: true, status: true, deletedAt: true } },
            },
          },
        },
      });

      // An item pointing at an unpublished or deleted page is a hole in the
      // navigation that nobody sees until a visitor clicks it.
      res.json({
        navigations: navigations.map((navigation) => ({
          ...navigation,
          items: navigation.items.map((item) => ({
            ...item,
            problem:
              item.kind === 'PAGE' && item.page === null
                ? 'This item points at a page that no longer exists.'
                : item.page?.deletedAt
                  ? 'This item points at a deleted page.'
                  : item.page && item.page.status !== 'PUBLISHED'
                    ? `The page this points at is ${item.page.status.toLowerCase().replace(/_/g, ' ')}, so the link will 404.`
                    : item.kind === 'EXTERNAL' && !item.externalUrl
                      ? 'This item has no address.'
                      : null,
          })),
        })),
      });
    }),
  );

  const navigationItemInput = z.object({
    kind: z.enum(['PAGE', 'EXTERNAL', 'HEADING', 'FEATURED', 'DIVIDER']),
    label: z.string().min(1).max(120),
    descriptor: z.string().max(240).nullish(),
    pageId: z.string().cuid().nullish(),
    externalUrl: z.string().url().max(500).nullish(),
    opensInNewTab: z.boolean().optional(),
    isCallToAction: z.boolean().optional(),
    parentId: z.string().cuid().nullish(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    isVisible: z.boolean().optional(),
    featuredEyebrow: z.string().max(80).nullish(),
    featuredHeadline: z.string().max(160).nullish(),
    featuredStoryId: z.string().cuid().nullish(),
    featuredImageId: z.string().cuid().nullish(),
  });

  router.post(
    '/navigation/:id/items',
    requirePermission('navigation.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = navigationItemInput.parse(req.body);

      const navigation = await req.ctx.prisma.navigation.findUnique({
        where: { id: param(req, 'id') },
        select: { id: true, label: true },
      });
      if (!navigation) throw ApiError.notFound('Navigation');

      assertItemIsUsable(input);

      const item = await req.ctx.prisma.navigationItem.create({
        data: { ...input, navigationId: navigation.id } as Prisma.NavigationItemUncheckedCreateInput,
      });

      await audit(req, 'CREATE', 'navigationItem', item.id, item.label, `Added to ${navigation.label}`);
      res.status(201).json({ item });
    }),
  );

  router.patch(
    '/navigation/items/:id',
    requirePermission('navigation.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = navigationItemInput.partial().parse(req.body);

      const existing = await req.ctx.prisma.navigationItem.findUnique({
        where: { id: param(req, 'id') },
      });
      if (!existing) throw ApiError.notFound('Navigation item');

      assertItemIsUsable({ ...existing, ...input });

      // A parent cycle would make the menu render forever.
      if (input.parentId) await assertNoCycle(req.ctx.prisma, existing.id, input.parentId);

      const item = await req.ctx.prisma.navigationItem.update({
        where: { id: existing.id },
        data: input as Prisma.NavigationItemUncheckedUpdateInput,
      });

      await audit(req, 'UPDATE', 'navigationItem', item.id, item.label, 'Updated a navigation item');
      res.json({ item });
    }),
  );

  router.delete(
    '/navigation/items/:id',
    requirePermission('navigation.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const existing = await req.ctx.prisma.navigationItem.findUnique({
        where: { id: param(req, 'id') },
        select: { id: true, label: true, _count: { select: { children: true } } },
      });
      if (!existing) throw ApiError.notFound('Navigation item');

      if (existing._count.children > 0) {
        throw ApiError.conflict('This item has items beneath it. Move or remove those first.');
      }

      await req.ctx.prisma.navigationItem.delete({ where: { id: existing.id } });
      await audit(req, 'DELETE', 'navigationItem', existing.id, existing.label, 'Removed a navigation item');
      res.status(204).end();
    }),
  );

  /** Reorder in one request, so a drag does not produce a burst of writes. */
  router.post(
    '/navigation/:id/reorder',
    requirePermission('navigation.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const { items } = z
        .object({
          items: z
            .array(z.object({ id: z.string().cuid(), parentId: z.string().cuid().nullable(), sortOrder: z.number().int().min(0) }))
            .max(200),
        })
        .parse(req.body);

      const navigation = await req.ctx.prisma.navigation.findUnique({
        where: { id: param(req, 'id') },
        select: { id: true, label: true },
      });
      if (!navigation) throw ApiError.notFound('Navigation');

      await req.ctx.prisma.$transaction(
        items.map((item) =>
          req.ctx.prisma.navigationItem.update({
            where: { id: item.id },
            data: { parentId: item.parentId, sortOrder: item.sortOrder },
          }),
        ),
      );

      await audit(req, 'UPDATE', 'navigation', navigation.id, navigation.label, `Reordered ${items.length} item(s)`);
      res.json({ ok: true });
    }),
  );

  // ===========================================================================
  // Footer
  // ===========================================================================

  router.get(
    '/footer',
    requirePermission('navigation.manage'),
    asyncHandler(async (req, res) => {
      res.json({
        footers: await req.ctx.prisma.footerConfiguration.findMany({ orderBy: { locale: 'asc' } }),
      });
    }),
  );

  router.patch(
    '/footer/:locale',
    requirePermission('navigation.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const locale = z.enum(['en', 'ur']).parse(param(req, 'locale'));
      const input = z
        .object({
          copyrightTemplate: z.string().max(200).optional(),
          showLocaleSwitch: z.boolean().optional(),
          regionLabel: z.string().max(80).optional(),
          note: z.string().max(400).nullish(),
          socialLinks: z
            .array(z.object({ label: z.string().max(60), url: z.string().url().max(400) }))
            .max(12)
            .optional(),
          legalLinks: z
            .array(z.object({ label: z.string().max(60), path: z.string().max(200) }))
            .max(12)
            .optional(),
        })
        .strict()
        .parse(req.body);

      const footer = await req.ctx.prisma.footerConfiguration.update({
        where: { locale },
        data: {
          ...input,
          ...(input.socialLinks ? { socialLinks: input.socialLinks as unknown as Prisma.InputJsonValue } : {}),
          ...(input.legalLinks ? { legalLinks: input.legalLinks as unknown as Prisma.InputJsonValue } : {}),
          updatedById: req.principal!.id,
        },
      });

      await audit(req, 'UPDATE', 'footerConfiguration', footer.id, `Footer (${locale})`, 'Updated the footer');
      res.json({ footer });
    }),
  );

  // ===========================================================================
  // Redirects
  // ===========================================================================

  router.get(
    '/redirects',
    requirePermission('redirects.manage'),
    asyncHandler(async (req, res) => {
      const query = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(PAGINATION.cmsDefaultPageSize),
          q: z.string().max(200).optional(),
          isAutomatic: z.enum(['true', 'false']).optional(),
        })
        .parse(req.query);

      const where: Prisma.RedirectWhereInput = {
        ...(query.isAutomatic ? { isAutomatic: query.isAutomatic === 'true' } : {}),
        ...(query.q
          ? {
              OR: [
                { source: { contains: query.q, mode: 'insensitive' } },
                { destination: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [items, total, automatic] = await Promise.all([
        req.ctx.prisma.redirect.findMany({
          where,
          orderBy: [{ hitCount: 'desc' }, { createdAt: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        req.ctx.prisma.redirect.count({ where }),
        req.ctx.prisma.redirect.count({ where: { isAutomatic: true } }),
      ]);

      res.json({
        items,
        meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
        facets: { automatic },
      });
    }),
  );

  const redirectInput = z.object({
    source: z.string().min(1).max(500),
    destination: z.string().min(1).max(500),
    statusCode: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).optional(),
    locale: z.enum(['en', 'ur']).nullish(),
    isEnabled: z.boolean().optional(),
    note: z.string().max(400).nullish(),
  });

  router.post(
    '/redirects',
    requirePermission('redirects.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = redirectInput.parse(req.body);
      const source = normalizePath(input.source);
      const destination = input.destination.startsWith('http')
        ? input.destination
        : normalizePath(input.destination);

      await assertRedirectIsSafe(req.ctx.prisma, source, destination);

      const redirect = await req.ctx.prisma.redirect.create({
        data: {
          source,
          destination,
          statusCode: input.statusCode ?? 301,
          locale: input.locale ?? null,
          isEnabled: input.isEnabled ?? true,
          note: input.note ?? null,
          isAutomatic: false,
          createdById: req.principal!.id,
        },
      });

      await audit(req, 'CREATE', 'redirect', redirect.id, `${source} → ${destination}`, 'Created a redirect');
      res.status(201).json({ redirect });
    }),
  );

  router.patch(
    '/redirects/:id',
    requirePermission('redirects.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = redirectInput.partial().parse(req.body);

      const existing = await req.ctx.prisma.redirect.findUnique({ where: { id: param(req, 'id') } });
      if (!existing) throw ApiError.notFound('Redirect');

      const source = input.source ? normalizePath(input.source) : existing.source;
      const destination = input.destination
        ? input.destination.startsWith('http')
          ? input.destination
          : normalizePath(input.destination)
        : existing.destination;

      await assertRedirectIsSafe(req.ctx.prisma, source, destination, existing.id);

      const redirect = await req.ctx.prisma.redirect.update({
        where: { id: existing.id },
        data: { ...input, source, destination },
      });

      await audit(req, 'UPDATE', 'redirect', redirect.id, `${source} → ${destination}`, 'Updated a redirect', {
        before: { source: existing.source, destination: existing.destination, isEnabled: existing.isEnabled },
        after: { source, destination, isEnabled: redirect.isEnabled },
      });
      res.json({ redirect });
    }),
  );

  router.delete(
    '/redirects/:id',
    requirePermission('redirects.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const existing = await req.ctx.prisma.redirect.findUnique({
        where: { id: param(req, 'id') },
        select: { id: true, source: true, destination: true, isAutomatic: true, hitCount: true },
      });
      if (!existing) throw ApiError.notFound('Redirect');

      await req.ctx.prisma.redirect.delete({ where: { id: existing.id } });
      await audit(
        req,
        'DELETE',
        'redirect',
        existing.id,
        `${existing.source} → ${existing.destination}`,
        existing.hitCount > 0
          ? `Deleted a redirect that had been followed ${existing.hitCount} time(s)`
          : 'Deleted a redirect',
      );
      res.status(204).end();
    }),
  );

  // ===========================================================================
  // Forms
  // ===========================================================================

  router.get(
    '/forms',
    requirePermission('forms.read', 'forms.manage'),
    asyncHandler(async (req, res) => {
      const forms = await req.ctx.prisma.formDefinition.findMany({
        orderBy: { name: 'asc' },
        include: {
          fields: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { submissions: true } },
        },
      });

      res.json({ forms });
    }),
  );

  router.get(
    '/forms/submissions',
    requirePermission('forms.read'),
    asyncHandler(async (req, res) => {
      const query = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(PAGINATION.cmsDefaultPageSize),
          formId: z.string().cuid().optional(),
        })
        .parse(req.query);

      const where: Prisma.FormSubmissionWhereInput = {
        deletedAt: null,
        ...(query.formId ? { formId: query.formId } : {}),
      };

      const [items, total] = await Promise.all([
        req.ctx.prisma.formSubmission.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            id: true,
            reference: true,
            status: true,
            createdAt: true,
            form: { select: { id: true, name: true } },
            _count: { select: { files: true } },
          },
        }),
        req.ctx.prisma.formSubmission.count({ where }),
      ]);

      // The answers themselves are deliberately not in the list: a form can
      // collect anything, so the only safe assumption is that it collected
      // personal data.
      res.json({
        items,
        meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
      });
    }),
  );

  // ===========================================================================
  // Localization
  // ===========================================================================

  router.get(
    '/localization',
    requirePermission('localization.read', 'localization.manage'),
    asyncHandler(async (req, res) => {
      const [locales, pageCounts, storyCounts, untranslatedPages] = await Promise.all([
        req.ctx.prisma.localeConfig.findMany({ orderBy: { sortOrder: 'asc' } }),
        req.ctx.prisma.page.groupBy({
          by: ['locale', 'translationStatus'],
          where: { deletedAt: null },
          _count: true,
        }),
        req.ctx.prisma.story.groupBy({
          by: ['locale', 'translationStatus'],
          where: { deletedAt: null },
          _count: true,
        }),
        // A published English page with no counterpart is the gap that matters:
        // it is live, and half the audience cannot read it.
        req.ctx.prisma.$queryRaw<Array<{ id: string; title: string; path: string }>>`
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
          ORDER BY p.path
          LIMIT 100
        `,
      ]);

      res.json({
        locales,
        counts: {
          pages: pageCounts.map((row) => ({ locale: row.locale, status: row.translationStatus, count: row._count })),
          stories: storyCounts.map((row) => ({ locale: row.locale, status: row.translationStatus, count: row._count })),
        },
        untranslatedPages,
      });
    }),
  );

  // ===========================================================================
  // Content health
  // ===========================================================================

  router.get(
    '/content-health',
    requirePermission('contentHealth.read'),
    asyncHandler(async (req, res) => {
      const query = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(50),
          type: z.string().max(60).optional(),
          severity: z.enum(['INFO', 'WARNING', 'ERROR']).optional(),
          includeDismissed: z.enum(['true', 'false']).optional(),
        })
        .parse(req.query);

      const where: Prisma.ContentHealthIssueWhereInput = {
        resolvedAt: null,
        ...(query.includeDismissed === 'true' ? {} : { dismissedAt: null }),
        ...(query.type ? { type: query.type as never } : {}),
        ...(query.severity ? { severity: query.severity } : {}),
      };

      const [items, total, byType] = await Promise.all([
        req.ctx.prisma.contentHealthIssue.findMany({
          where,
          orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        req.ctx.prisma.contentHealthIssue.count({ where }),
        req.ctx.prisma.contentHealthIssue.groupBy({
          by: ['type', 'severity'],
          where: { resolvedAt: null, dismissedAt: null },
          _count: true,
        }),
      ]);

      res.json({
        items,
        meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
        facets: { byType: byType.map((row) => ({ type: row.type, severity: row.severity, count: row._count })) },
      });
    }),
  );

  router.post(
    '/content-health/:id/dismiss',
    requirePermission('contentHealth.read'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const { reason } = z.object({ reason: z.string().min(1).max(400) }).parse(req.body);

      const issue = await req.ctx.prisma.contentHealthIssue.findUnique({ where: { id: param(req, 'id') } });
      if (!issue) throw ApiError.notFound('Issue');

      // Dismissing needs a reason, so "we know, and here is why" survives the
      // person who knew it.
      await req.ctx.prisma.contentHealthIssue.update({
        where: { id: issue.id },
        data: { dismissedAt: new Date(), dismissedById: req.principal!.id, dismissReason: reason },
      });

      await audit(req, 'UPDATE', 'contentHealthIssue', issue.id, issue.entityLabel, `Dismissed: ${reason}`);
      res.json({ ok: true });
    }),
  );

  // ===========================================================================
  // Integrations
  // ===========================================================================

  router.get(
    '/integrations',
    requirePermission('integrations.manage'),
    asyncHandler(async (req, res) => {
      const integrations = await req.ctx.prisma.integration.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          key: true,
          name: true,
          provider: true,
          isEnabled: true,
          lastSyncAt: true,
          updatedAt: true,
          // `config` holds credentials. It is never returned; the CMS shows
          // which keys are set, never their values.
          webhooks: {
            // `secretRef` is a pointer to a secret, not the secret, and is still
            // not returned: nothing about credentials leaves the server.
            select: {
              id: true,
              name: true,
              url: true,
              events: true,
              isEnabled: true,
              lastDeliveryAt: true,
              lastDeliveryStatus: true,
              failureCount: true,
            },
          },
        },
      });

      const configured = await req.ctx.prisma.integration.findMany({
        select: { id: true, config: true },
      });
      const configuredKeys = new Map(
        configured.map((integration) => [
          integration.id,
          integration.config && typeof integration.config === 'object' && !Array.isArray(integration.config)
            ? Object.keys(integration.config as Record<string, unknown>)
            : [],
        ]),
      );

      res.json({
        integrations: integrations.map((integration) => ({
          ...integration,
          configuredKeys: configuredKeys.get(integration.id) ?? [],
        })),
      });
    }),
  );

  router.patch(
    '/integrations/:id',
    requirePermission('integrations.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = z.object({ isEnabled: z.boolean() }).strict().parse(req.body);

      const existing = await req.ctx.prisma.integration.findUnique({
        where: { id: param(req, 'id') },
        select: { id: true, name: true, isEnabled: true },
      });
      if (!existing) throw ApiError.notFound('Integration');

      await req.ctx.prisma.integration.update({ where: { id: existing.id }, data: input });

      await audit(
        req,
        'UPDATE',
        'integration',
        existing.id,
        existing.name,
        input.isEnabled ? 'Enabled the integration' : 'Disabled the integration',
        { before: { isEnabled: existing.isEnabled }, after: { isEnabled: input.isEnabled } },
      );

      res.json({ ok: true });
    }),
  );

  return router;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** A navigation item has to be able to lead somewhere. */
function assertItemIsUsable(item: { kind?: string; pageId?: string | null; externalUrl?: string | null }): void {
  if (item.kind === 'PAGE' && !item.pageId) {
    throw ApiError.validation([{ field: 'pageId', message: 'Choose the page this links to.' }]);
  }
  if (item.kind === 'EXTERNAL' && !item.externalUrl) {
    throw ApiError.validation([{ field: 'externalUrl', message: 'Enter the address this links to.' }]);
  }
}

/** Walk up the parents; a cycle would render the menu forever. */
async function assertNoCycle(
  prisma: import('@cheezious/database').PrismaClient,
  itemId: string,
  parentId: string,
): Promise<void> {
  let current: string | null = parentId;

  for (let depth = 0; depth < 20 && current; depth += 1) {
    if (current === itemId) {
      throw ApiError.validation([
        { field: 'parentId', message: 'That would put this item inside itself.' },
      ]);
    }
    const parent: { parentId: string | null } | null = await prisma.navigationItem.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = parent?.parentId ?? null;
  }
}

/**
 * A redirect must not point at itself, and must not extend a chain into a loop.
 *
 * Chains are followed to a fixed depth rather than forbidden outright: one
 * redirect pointing at another is normal after two renames, and refusing it
 * would push people into editing the old one by hand.
 */
async function assertRedirectIsSafe(
  prisma: import('@cheezious/database').PrismaClient,
  source: string,
  destination: string,
  excludeId?: string,
): Promise<void> {
  if (source === destination) {
    throw ApiError.validation([{ field: 'destination', message: 'A redirect cannot point at itself.' }]);
  }

  const clash = await prisma.redirect.findFirst({
    where: { source, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) {
    throw ApiError.conflict('A redirect already exists for that address.');
  }

  let current = destination;
  for (let depth = 0; depth < 10; depth += 1) {
    if (current.startsWith('http')) return;

    const next: { destination: string } | null = await prisma.redirect.findFirst({
      where: { source: current, isEnabled: true, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { destination: true },
    });
    if (!next) return;

    if (next.destination === source) {
      throw ApiError.validation([
        { field: 'destination', message: 'That would create a redirect loop back to this address.' },
      ]);
    }
    current = next.destination;
  }

  throw ApiError.validation([
    { field: 'destination', message: 'That extends a redirect chain too far. Point it at the final address.' },
  ]);
}

async function audit(
  req: import('express').Request,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entityType: string,
  entityId: string,
  entityLabel: string,
  summary: string,
  diff?: { before?: Record<string, unknown>; after?: Record<string, unknown> },
): Promise<void> {
  await new AuditService(req.ctx.prisma).record(
    { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
    { action, entityType, entityId, entityLabel, summary, ...(diff ?? {}) },
  );
}
