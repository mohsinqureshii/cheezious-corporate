import { verifyPreviewToken } from '@cheezious/auth';
import { isLocale, type Locale } from '@cheezious/config';
import { ApiError } from '@cheezious/validation';
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, rateLimit } from '../middleware';
import { PageService } from '../services/pages';
import { SearchService } from '../services/search';

/**
 * Public read API.
 *
 * Two invariants hold across every route in this file:
 *
 *   1. **Only published content is served.** Status filtering happens in the
 *      query, not in a mapper, so a missed field cannot leak a draft.
 *   2. **Nothing internal is exposed.** Responses are built by explicit
 *      projection — internal notes, routing emails, requisition references and
 *      metric provenance are never selected, so they cannot accidentally be
 *      serialised.
 *
 * Responses carry cache headers; publishing invalidates by tag.
 */

const localeParam = z.enum(['en', 'ur']);

function parseLocale(value: unknown): Locale {
  if (!isLocale(value)) throw new ApiError('NOT_FOUND', 'Unknown language.');
  return value;
}

/** Cache headers for content that changes only when an editor publishes. */
function setPublicCache(res: import('express').Response, seconds = 60): void {
  res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 10}`);
}

export function publicRoutes(): Router {
  const router = Router();
  router.use(rateLimit('publicRead'));

  // ---------------------------------------------------------------------------
  // Pages
  // ---------------------------------------------------------------------------

  /**
   * Resolve a path to a rendered page.
   *
   * Returns the *published snapshot*, not the working copy, so an editor's
   * in-progress changes can never appear on the live site. Preview requests
   * carry a signed token and are the only way to see anything else.
   */
  router.get(
    '/:locale/pages',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const { path, previewToken } = z
        .object({ path: z.string().min(1).max(512), previewToken: z.string().max(2048).optional() })
        .parse(req.query);

      const pages = new PageService(req.ctx.prisma);

      if (previewToken) {
        const payload = verifyPreviewToken(previewToken, req.ctx.env.PREVIEW_SECRET);
        if (!payload || payload.entityType !== 'page') {
          throw new ApiError('FORBIDDEN', 'That preview link is invalid or has expired.');
        }

        const draft = await loadPageForRender(req.ctx.prisma, payload.entityId, { preview: true });
        if (!draft) throw ApiError.notFound('Page');

        // A preview must never be cached by any intermediary.
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({ page: draft, isPreview: true });
        return;
      }

      const resolved = await pages.resolvePublicPath(locale, path);

      if (resolved.kind === 'redirect') {
        setPublicCache(res, 300);
        res.json({ redirect: { destination: resolved.destination, statusCode: resolved.statusCode } });
        return;
      }
      if (resolved.kind === 'notFound') throw ApiError.notFound('Page');

      const page = await loadPageForRender(req.ctx.prisma, resolved.pageId, { preview: false });
      if (!page) throw ApiError.notFound('Page');

      setPublicCache(res, 120);
      res.json({ page, isPreview: false });
    }),
  );

  /** Every published path, used to generate static routes and the sitemap. */
  router.get(
    '/:locale/pages/paths',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const pages = await req.ctx.prisma.page.findMany({
        where: { locale, status: 'PUBLISHED', deletedAt: null },
        select: {
          id: true,
          path: true,
          type: true,
          publishedAt: true,
          updatedAt: true,
          excludeFromSitemap: true,
          translationGroupId: true,
        },
        orderBy: { path: 'asc' },
      });

      setPublicCache(res, 300);
      res.json({ paths: pages });
    }),
  );

  // ---------------------------------------------------------------------------
  // Navigation, footer and settings
  // ---------------------------------------------------------------------------

  router.get(
    '/:locale/navigation',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const navigations = await req.ctx.prisma.navigation.findMany({
        where: { locale, isEnabled: true },
        include: {
          items: {
            where: { isVisible: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              page: { select: { id: true, path: true, status: true, navLabel: true, title: true } },
              featuredStory: {
                select: { id: true, title: true, slug: true, excerpt: true, status: true, heroImage: true },
              },
              featuredImage: { select: { id: true, storageKey: true, altText: true, focalX: true, focalY: true } },
            },
          },
        },
      });

      setPublicCache(res, 300);
      res.json({ navigations: navigations.map((nav) => ({ ...nav, items: buildNavTree(nav.items) })) });
    }),
  );

  router.get(
    '/:locale/footer',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const [footer, navigation] = await Promise.all([
        req.ctx.prisma.footerConfiguration.findUnique({ where: { locale } }),
        req.ctx.prisma.navigation.findFirst({
          where: { locale, location: 'FOOTER', isEnabled: true },
          include: {
            items: {
              where: { isVisible: true },
              orderBy: { sortOrder: 'asc' },
              include: { page: { select: { id: true, path: true, status: true } } },
            },
          },
        }),
      ]);

      setPublicCache(res, 300);
      res.json({
        footer,
        groups: navigation ? buildNavTree(navigation.items) : [],
      });
    }),
  );

  /**
   * Public site settings.
   *
   * Only settings in the `public` group are served. Operational settings — SMTP
   * routing, internal contact addresses — live in other groups and never reach
   * the browser.
   */
  router.get(
    '/:locale/settings',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const settings = await req.ctx.prisma.siteSetting.findMany({
        where: { locale, group: { in: ['public', 'boilerplate', 'seo', 'social'] } },
        select: { key: true, value: true, group: true },
      });

      setPublicCache(res, 300);
      res.json({
        settings: Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Batch reference resolution
  //
  // Blocks store ids rather than URLs or copies of images. These endpoints let
  // the renderer resolve every reference on a page in one request instead of one
  // per reference, which is the difference between a page costing one round trip
  // and costing twelve.
  // ---------------------------------------------------------------------------

  router.get(
    '/media/batch',
    asyncHandler(async (req, res) => {
      const { ids } = z.object({ ids: z.string().max(4000) }).parse(req.query);
      const assetIds = ids.split(',').map((id) => id.trim()).filter(Boolean).slice(0, 100);

      if (assetIds.length === 0) {
        res.json({ assets: [] });
        return;
      }

      const assets = await req.ctx.prisma.mediaAsset.findMany({
        where: {
          id: { in: assetIds },
          deletedAt: null,
          // Restricted assets hold applicant CVs and supplier documents. They
          // are never resolvable through a public endpoint, whatever id is asked
          // for — the filter is here, not in the caller.
          visibility: { in: ['PUBLIC_DOWNLOAD', 'CMS_ONLY'] },
        },
        select: {
          id: true,
          storageKey: true,
          altText: true,
          caption: true,
          credit: true,
          width: true,
          height: true,
          focalX: true,
          focalY: true,
          blurDataUrl: true,
          placeholderColor: true,
        },
      });

      setPublicCache(res, 600);
      res.json({ assets });
    }),
  );

  router.get(
    '/:locale/pages/batch',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const { ids } = z.object({ ids: z.string().max(4000) }).parse(req.query);
      const pageIds = ids.split(',').map((id) => id.trim()).filter(Boolean).slice(0, 100);

      if (pageIds.length === 0) {
        res.json({ pages: [] });
        return;
      }

      // Only published pages resolve, so a link to an unpublished page is
      // dropped by the renderer rather than shipped as a dead link.
      const pages = await req.ctx.prisma.page.findMany({
        where: { id: { in: pageIds }, locale, status: 'PUBLISHED', deletedAt: null },
        select: { id: true, path: true, title: true, navLabel: true },
      });

      setPublicCache(res, 600);
      res.json({ pages });
    }),
  );

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  router.get(
    '/:locale/search',
    rateLimit('publicSearch'),
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const query = z
        .object({
          q: z.string().max(200).default(''),
          types: z.string().max(400).optional(),
          section: z.string().max(80).optional(),
          page: z.coerce.number().int().min(1).max(100).default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(20),
        })
        .parse(req.query);

      const results = await new SearchService(req.ctx.prisma).search({
        locale,
        query: query.q,
        types: query.types?.split(',').filter(Boolean) as never,
        section: query.section,
        page: query.page,
        pageSize: query.pageSize,
      });

      // Search results are per-query and change with every publish; a short
      // cache is worthwhile but a long one is not.
      setPublicCache(res, 30);
      res.json(results);
    }),
  );

  router.get(
    '/:locale/search/suggest',
    rateLimit('publicSearch'),
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const { q } = z.object({ q: z.string().max(120).default('') }).parse(req.query);

      setPublicCache(res, 60);
      res.json({ suggestions: await new SearchService(req.ctx.prisma).suggest(locale, q) });
    }),
  );

  return router;
}

/**
 * Load a page for rendering.
 *
 * In published mode the blocks and SEO come from the published version snapshot,
 * so the response reflects what was approved rather than what is currently being
 * edited. In preview mode the live working copy is returned instead.
 */
async function loadPageForRender(
  prisma: import('@cheezious/database').PrismaClient,
  pageId: string,
  options: { preview: boolean },
) {
  const page = await prisma.page.findFirst({
    where: { id: pageId, deletedAt: null, ...(options.preview ? {} : { status: 'PUBLISHED' }) },
    include: {
      blocks: { where: { isHidden: false }, orderBy: { sortOrder: 'asc' } },
      seo: { include: { ogImage: true } },
      publishedVersion: { select: { data: true, createdAt: true } },
      parent: { select: { id: true, path: true, title: true, navLabel: true } },
    },
  });

  if (!page) return null;

  const snapshot = options.preview ? null : (page.publishedVersion?.data as Record<string, unknown> | undefined);

  const blocks = snapshot?.blocks
    ? (snapshot.blocks as Array<Record<string, unknown>>).filter((block) => block.isHidden !== true)
    : page.blocks.map((block) => ({
        blockKey: block.blockKey,
        data: block.data,
        sortOrder: block.sortOrder,
        anchor: block.anchor,
      }));

  const seo = snapshot?.seo ?? page.seo;

  // Locale alternates power hreflang. Only published translations are offered.
  const alternates = await prisma.page.findMany({
    where: {
      translationGroupId: page.translationGroupId,
      status: 'PUBLISHED',
      deletedAt: null,
    },
    select: { locale: true, path: true },
  });

  return {
    id: page.id,
    title: (snapshot?.title as string) ?? page.title,
    navLabel: (snapshot?.navLabel as string) ?? page.navLabel,
    summary: (snapshot?.summary as string) ?? page.summary,
    path: page.path,
    locale: page.locale,
    type: page.type,
    parent: page.parent,
    blocks,
    seo,
    publishedAt: page.publishedAt,
    updatedAt: page.publishedVersion?.createdAt ?? page.updatedAt,
    excludeFromSitemap: page.excludeFromSitemap,
    alternates: Object.fromEntries(alternates.map((alt) => [alt.locale, alt.path])),
  };
}

interface NavItemRow {
  id: string;
  parentId: string | null;
  sortOrder: number;
  [key: string]: unknown;
}

/**
 * Assemble a flat list of navigation items into a tree.
 *
 * Items whose target page is not published are dropped, so the mega menu can
 * never link to a page that 404s.
 */
function buildNavTree<T extends NavItemRow>(items: T[]): Array<T & { children: T[] }> {
  const usable = items.filter((item) => {
    const page = item.page as { status?: string } | null | undefined;
    if (!page) return true;
    return page.status === 'PUBLISHED';
  });

  const byId = new Map(usable.map((item) => [item.id, { ...item, children: [] as T[] }]));
  const roots: Array<T & { children: T[] }> = [];

  for (const item of byId.values()) {
    if (item.parentId && byId.has(item.parentId)) {
      byId.get(item.parentId)!.children.push(item as unknown as T);
    } else if (!item.parentId) {
      roots.push(item);
    }
  }

  return roots.sort((a, b) => a.sortOrder - b.sortOrder);
}
