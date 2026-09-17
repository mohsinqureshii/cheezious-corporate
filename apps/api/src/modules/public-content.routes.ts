import { isLocale, type Locale } from '@cheezious/config';
import type { Prisma, PrismaClient } from '@cheezious/database';
import { ApiError } from '@cheezious/validation';
import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, rateLimit } from '../middleware';

/**
 * Public content collections.
 *
 * Each collection is served through an explicit projection. Nothing is returned
 * by spreading a Prisma row, because that is exactly how an internal note or a
 * hiring manager's name ends up in a JSON response six months later.
 */

function parseLocale(value: unknown): Locale {
  if (!isLocale(value)) throw new ApiError('NOT_FOUND', 'Unknown language.');
  return value;
}

function setPublicCache(res: Response, seconds = 120): void {
  res.setHeader(
    'Cache-Control',
    `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 10}`,
  );
}

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

/** Image projection — everything the renderer needs, nothing more. */
const imageSelect = {
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
} satisfies Prisma.MediaAssetSelect;

export function publicContentRoutes(): Router {
  const router = Router();
  router.use(rateLimit('publicRead'));

  // ---------------------------------------------------------------------------
  // Newsroom: stories, news, people stories, press releases, coverage
  // ---------------------------------------------------------------------------

  router.get(
    '/:locale/stories',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const query = listQuery
        .extend({
          kind: z.string().max(80).optional(),
          category: z.string().max(80).optional(),
          tag: z.string().max(80).optional(),
          featured: z.coerce.boolean().optional(),
        })
        .parse(req.query);

      const where: Prisma.StoryWhereInput = {
        locale,
        status: 'PUBLISHED',
        deletedAt: null,
        ...(query.kind ? { kind: { in: query.kind.split(',') } } : {}),
        ...(query.category ? { category: { slug: query.category } } : {}),
        ...(query.tag ? { tags: { some: { tag: { slug: query.tag } } } } : {}),
        ...(query.featured ? { isFeatured: true } : {}),
      };

      const [items, total] = await Promise.all([
        req.ctx.prisma.story.findMany({
          where,
          orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: storyListSelect,
        }),
        req.ctx.prisma.story.count({ where }),
      ]);

      setPublicCache(res);
      res.json({ items, total, page: query.page, pageSize: query.pageSize });
    }),
  );

  router.get(
    '/:locale/stories/:slug',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const story = await req.ctx.prisma.story.findFirst({
        where: { locale, slug: req.params.slug, status: 'PUBLISHED', deletedAt: null },
        select: {
          ...storyListSelect,
          body: true,
          authorName: true,
          translationGroupId: true,
          seoTitle: true,
          seoDescription: true,
          noindex: true,
          updatedAt: true,
          people: {
            select: {
              role: true,
              person: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  role: true,
                  portrait: { select: imageSelect },
                },
              },
            },
          },
          relatedFrom: {
            orderBy: { sortOrder: 'asc' },
            take: 4,
            select: { to: { select: storyListSelect } },
          },
        },
      });
      if (!story) throw ApiError.notFound('Story');

      const alternates = await localeAlternates(req.ctx.prisma, 'story', story.translationGroupId);

      setPublicCache(res);
      res.json({
        story: {
          ...story,
          // Only published people are exposed through a story's relations.
          related: story.relatedFrom.map((relation) => relation.to),
          relatedFrom: undefined,
        },
        alternates,
      });
    }),
  );

  router.get(
    '/:locale/press-releases',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const query = listQuery
        .extend({
          year: z.coerce.number().int().min(1990).max(2100).optional(),
          category: z.string().max(80).optional(),
        })
        .parse(req.query);

      const where: Prisma.PressReleaseWhereInput = {
        locale,
        status: 'PUBLISHED',
        deletedAt: null,
        ...(query.category ? { category: { slug: query.category } } : {}),
        ...(query.year
          ? {
              publishedAt: {
                gte: new Date(Date.UTC(query.year, 0, 1)),
                lt: new Date(Date.UTC(query.year + 1, 0, 1)),
              },
            }
          : {}),
      };

      const [items, total, years] = await Promise.all([
        req.ctx.prisma.pressRelease.findMany({
          where,
          orderBy: { publishedAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: pressReleaseListSelect,
        }),
        req.ctx.prisma.pressRelease.count({ where }),
        availableYears(req.ctx.prisma, 'press_releases', locale),
      ]);

      setPublicCache(res);
      res.json({ items, total, page: query.page, pageSize: query.pageSize, years });
    }),
  );

  router.get(
    '/:locale/press-releases/:slug',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const release = await req.ctx.prisma.pressRelease.findFirst({
        where: { locale, slug: req.params.slug, status: 'PUBLISHED', deletedAt: null },
        select: {
          ...pressReleaseListSelect,
          body: true,
          translationGroupId: true,
          seoTitle: true,
          seoDescription: true,
          noindex: true,
          updatedAt: true,
          // A media contact is published deliberately; unpublished contacts are
          // filtered out rather than exposed with the release.
          mediaContact: {
            select: {
              id: true,
              name: true,
              role: true,
              email: true,
              phone: true,
              isPublished: true,
            },
          },
          attachments: {
            orderBy: { sortOrder: 'asc' },
            select: {
              label: true,
              asset: {
                select: {
                  id: true,
                  storageKey: true,
                  originalName: true,
                  mimeType: true,
                  byteSize: true,
                  visibility: true,
                },
              },
            },
          },
        },
      });
      if (!release) throw ApiError.notFound('Press release');

      setPublicCache(res);
      res.json({
        pressRelease: {
          ...release,
          mediaContact: release.mediaContact?.isPublished ? release.mediaContact : null,
          // Only assets cleared for public download are offered.
          attachments: release.attachments.filter((a) => a.asset.visibility === 'PUBLIC_DOWNLOAD'),
        },
        alternates: await localeAlternates(
          req.ctx.prisma,
          'pressRelease',
          release.translationGroupId,
        ),
      });
    }),
  );

  router.get(
    '/:locale/media-coverage',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const query = listQuery.parse(req.query);

      const where: Prisma.MediaCoverageWhereInput = { locale, isPublished: true };
      const [items, total] = await Promise.all([
        req.ctx.prisma.mediaCoverage.findMany({
          where,
          orderBy: { publishedOn: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            id: true,
            title: true,
            outlet: true,
            url: true,
            publishedOn: true,
            summary: true,
            logo: { select: imageSelect },
          },
        }),
        req.ctx.prisma.mediaCoverage.count({ where }),
      ]);

      setPublicCache(res);
      res.json({ items, total, page: query.page, pageSize: query.pageSize });
    }),
  );

  router.get(
    '/:locale/media-contacts',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      setPublicCache(res, 300);
      res.json({
        contacts: await req.ctx.prisma.mediaContact.findMany({
          where: { locale, isPublished: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            phone: true,
            region: true,
            topics: true,
          },
        }),
      });
    }),
  );

  /** Downloadable press and brand assets. Filtered to PUBLIC_DOWNLOAD only. */
  router.get(
    '/:locale/media-library',
    asyncHandler(async (req, res) => {
      const query = z
        .object({
          kind: z.enum(['IMAGE', 'DOCUMENT', 'VIDEO']).optional(),
          brandOnly: z.coerce.boolean().optional(),
          pressOnly: z.coerce.boolean().optional(),
          folder: z.string().max(200).optional(),
        })
        .parse(req.query);

      const assets = await req.ctx.prisma.mediaAsset.findMany({
        where: {
          visibility: 'PUBLIC_DOWNLOAD',
          deletedAt: null,
          ...(query.kind ? { kind: query.kind } : {}),
          ...(query.brandOnly ? { isBrandAsset: true } : {}),
          ...(query.pressOnly ? { isPressAsset: true } : {}),
          ...(query.folder ? { folder: { path: query.folder } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          kind: true,
          storageKey: true,
          originalName: true,
          title: true,
          altText: true,
          caption: true,
          credit: true,
          mimeType: true,
          byteSize: true,
          width: true,
          height: true,
          isBrandAsset: true,
          isPressAsset: true,
          folder: { select: { name: true, path: true } },
        },
      });

      setPublicCache(res, 300);
      res.json({ assets });
    }),
  );

  // ---------------------------------------------------------------------------
  // People and leadership
  // ---------------------------------------------------------------------------

  router.get(
    '/:locale/leadership',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const groups = await req.ctx.prisma.leadershipGroup.findMany({
        where: { isPublished: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          key: true,
          name: true,
          slug: true,
          summary: true,
          people: {
            where: { locale, status: 'PUBLISHED', deletedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: personListSelect,
          },
        },
      });

      setPublicCache(res, 300);
      res.json({ groups: groups.filter((group) => group.people.length > 0) });
    }),
  );

  router.get(
    '/:locale/people/:slug',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const person = await req.ctx.prisma.person.findFirst({
        where: { locale, slug: req.params.slug, status: 'PUBLISHED', deletedAt: null },
        select: {
          ...personListSelect,
          fullBio: true,
          responsibilities: true,
          careerBackground: true,
          quote: true,
          quoteAttribution: true,
          linkedinUrl: true,
          translationGroupId: true,
          seoTitle: true,
          seoDescription: true,
          updatedAt: true,
          heroImage: { select: imageSelect },
          leadershipGroup: { select: { id: true, name: true, slug: true } },
          storyLinks: {
            where: { story: { status: 'PUBLISHED', deletedAt: null, locale } },
            take: 6,
            select: { story: { select: storyListSelect } },
          },
        },
      });
      if (!person) throw ApiError.notFound('Profile');

      setPublicCache(res);
      res.json({
        person: {
          ...person,
          relatedStories: person.storyLinks.map((link) => link.story),
          storyLinks: undefined,
        },
        alternates: await localeAlternates(req.ctx.prisma, 'person', person.translationGroupId),
      });
    }),
  );

  router.get(
    '/:locale/employee-stories',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const query = listQuery.parse(req.query);

      const where: Prisma.EmployeeStoryWhereInput = { locale, isPublished: true };
      const [items, total] = await Promise.all([
        req.ctx.prisma.employeeStory.findMany({
          where,
          orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: employeeStoryListSelect,
        }),
        req.ctx.prisma.employeeStory.count({ where }),
      ]);

      setPublicCache(res);
      res.json({ items, total, page: query.page, pageSize: query.pageSize });
    }),
  );

  router.get(
    '/:locale/employee-stories/:slug',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const story = await req.ctx.prisma.employeeStory.findFirst({
        where: { locale, slug: req.params.slug, isPublished: true },
        select: {
          ...employeeStoryListSelect,
          body: true,
          quote: true,
          careerTimeline: true,
          translationGroupId: true,
          seoTitle: true,
          seoDescription: true,
          heroImage: { select: imageSelect },
        },
      });
      if (!story) throw ApiError.notFound('Story');

      setPublicCache(res);
      res.json({
        story,
        alternates: await localeAlternates(
          req.ctx.prisma,
          'employeeStory',
          story.translationGroupId,
        ),
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Company records
  // ---------------------------------------------------------------------------

  router.get(
    '/:locale/timeline',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const query = z
        .object({
          fromYear: z.coerce.number().int().optional(),
          toYear: z.coerce.number().int().optional(),
          featured: z.coerce.boolean().optional(),
        })
        .parse(req.query);

      setPublicCache(res, 300);
      res.json({
        events: await req.ctx.prisma.timelineEvent.findMany({
          where: {
            locale,
            isPublished: true,
            ...(query.featured ? { isFeatured: true } : {}),
            ...(query.fromYear || query.toYear
              ? {
                  year: {
                    ...(query.fromYear ? { gte: query.fromYear } : {}),
                    ...(query.toYear ? { lte: query.toYear } : {}),
                  },
                }
              : {}),
          },
          orderBy: [{ year: 'asc' }, { sortOrder: 'asc' }],
          select: {
            id: true,
            year: true,
            eventDate: true,
            headline: true,
            description: true,
            category: true,
            location: true,
            isFeatured: true,
            isDemoContent: true,
            media: { select: imageSelect },
          },
        }),
      });
    }),
  );

  router.get(
    '/:locale/awards',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      setPublicCache(res, 300);
      res.json({
        awards: await req.ctx.prisma.award.findMany({
          where: { locale, isPublished: true },
          orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }],
          select: {
            id: true,
            name: true,
            organisation: true,
            year: true,
            description: true,
            externalUrl: true,
            isDemoContent: true,
            category: { select: { name: true, slug: true } },
            image: { select: imageSelect },
          },
        }),
      });
    }),
  );

  /**
   * Corporate footprint.
   *
   * Figures are nullable throughout, and the renderer omits any metric without a
   * value — the platform never invents a restaurant count to fill a layout.
   */
  router.get(
    '/:locale/footprint',
    asyncHandler(async (req, res) => {
      setPublicCache(res, 300);
      res.json({
        regions: await req.ctx.prisma.region.findMany({
          where: { isPublished: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            kind: true,
            summary: true,
            cities: {
              where: { isPublished: true },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                name: true,
                slug: true,
                latitude: true,
                longitude: true,
                summary: true,
                restaurantCount: true,
                teamMemberCount: true,
                firstOpeningYear: true,
                facilityNote: true,
                isDemoContent: true,
                image: { select: imageSelect },
                corporateLocations: {
                  where: { isPublished: true },
                  orderBy: { sortOrder: 'asc' },
                  select: { id: true, name: true, kind: true, summary: true },
                },
              },
            },
          },
        }),
      });
    }),
  );

  router.get(
    '/:locale/ingredients',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      setPublicCache(res, 300);
      res.json({
        categories: await req.ctx.prisma.ingredientCategory.findMany({
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            summary: true,
            ingredients: {
              where: { locale, isPublished: true },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                name: true,
                slug: true,
                summary: true,
                isDemoContent: true,
                image: { select: imageSelect },
              },
            },
          },
        }),
      });
    }),
  );

  router.get(
    '/:locale/ingredients/:slug',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const ingredient = await req.ctx.prisma.ingredient.findFirst({
        where: { locale, slug: req.params.slug, isPublished: true },
        select: {
          id: true,
          name: true,
          slug: true,
          summary: true,
          qualityInformation: true,
          sourcingInformation: true,
          allergenInformation: true,
          isDemoContent: true,
          seoTitle: true,
          seoDescription: true,
          image: { select: imageSelect },
          category: { select: { name: true, slug: true } },
        },
      });
      if (!ingredient) throw ApiError.notFound('Ingredient');

      setPublicCache(res);
      res.json({ ingredient });
    }),
  );

  // ---------------------------------------------------------------------------
  // Impact
  // ---------------------------------------------------------------------------

  /**
   * Impact pillars and metrics.
   *
   * A metric appears publicly only when it is marked publishable *and* has a
   * value for the requested year. `internalSource` is never selected.
   */
  router.get(
    '/:locale/impact',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const { year } = z
        .object({ year: z.coerce.number().int().min(1990).max(2100).optional() })
        .parse(req.query);

      const pillars = await req.ctx.prisma.impactPillar.findMany({
        where: { locale, isPublished: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          key: true,
          name: true,
          slug: true,
          summary: true,
          description: true,
          icon: true,
          accentColor: true,
          metrics: {
            where: { isPublishable: true },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              key: true,
              name: true,
              unit: true,
              prefix: true,
              suffix: true,
              description: true,
              methodology: true,
              targetValue: true,
              targetYear: true,
              values: {
                ...(year ? { where: { year } } : {}),
                orderBy: { year: 'desc' },
                take: year ? 1 : 5,
                select: { year: true, value: true, note: true, isDemoContent: true },
              },
            },
          },
        },
      });

      setPublicCache(res, 300);
      res.json({
        pillars: pillars.map((pillar) => ({
          ...pillar,
          // Drop metrics with no approved value rather than rendering a zero.
          metrics: pillar.metrics.filter((metric) => metric.values.length > 0),
        })),
      });
    }),
  );

  router.get(
    '/:locale/impact/stories',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const query = listQuery.extend({ pillar: z.string().max(80).optional() }).parse(req.query);

      const where: Prisma.ImpactStoryWhereInput = {
        locale,
        isPublished: true,
        ...(query.pillar ? { pillar: { slug: query.pillar } } : {}),
      };

      const [items, total] = await Promise.all([
        req.ctx.prisma.impactStory.findMany({
          where,
          orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: impactStoryListSelect,
        }),
        req.ctx.prisma.impactStory.count({ where }),
      ]);

      setPublicCache(res);
      res.json({ items, total, page: query.page, pageSize: query.pageSize });
    }),
  );

  router.get(
    '/:locale/impact/stories/:slug',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const story = await req.ctx.prisma.impactStory.findFirst({
        where: { locale, slug: req.params.slug, isPublished: true },
        select: {
          ...impactStoryListSelect,
          body: true,
          seoTitle: true,
          seoDescription: true,
          translationGroupId: true,
        },
      });
      if (!story) throw ApiError.notFound('Story');

      setPublicCache(res);
      res.json({
        story,
        alternates: await localeAlternates(req.ctx.prisma, 'impactStory', story.translationGroupId),
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Reports and policies
  // ---------------------------------------------------------------------------

  router.get(
    '/:locale/reports',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const query = listQuery
        .extend({
          year: z.coerce.number().int().min(1990).max(2100).optional(),
          type: z.string().max(60).optional(),
          category: z.string().max(80).optional(),
        })
        .parse(req.query);

      const where: Prisma.ReportWhereInput = {
        locale,
        isPublished: true,
        ...(query.year ? { year: query.year } : {}),
        ...(query.type ? { type: query.type as never } : {}),
        ...(query.category ? { category: { slug: query.category } } : {}),
      };

      const [items, total, facets] = await Promise.all([
        req.ctx.prisma.report.findMany({
          where,
          orderBy: [{ isFeatured: 'desc' }, { year: 'desc' }, { sortOrder: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: reportListSelect,
        }),
        req.ctx.prisma.report.count({ where }),
        req.ctx.prisma.report.groupBy({
          by: ['year', 'type'],
          where: { locale, isPublished: true },
          _count: true,
        }),
      ]);

      setPublicCache(res, 300);
      res.json({
        items,
        total,
        page: query.page,
        pageSize: query.pageSize,
        facets: {
          years: [...new Set(facets.map((f) => f.year))].sort((a, b) => b - a),
          types: [...new Set(facets.map((f) => f.type))],
        },
      });
    }),
  );

  /**
   * One report.
   *
   * Registered after the listing, and reached by slug. A report is a document
   * with a page around it rather than an article: the page exists so the
   * document has an address that can be linked, shared and indexed, which a
   * direct link to a PDF in object storage cannot be.
   */
  router.get(
    '/:locale/reports/:slug',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const report = await req.ctx.prisma.report.findFirst({
        where: { locale, slug: req.params.slug, isPublished: true },
        select: {
          ...reportListSelect,
          seoTitle: true,
          seoDescription: true,
          translationGroupId: true,
          updatedAt: true,
        },
      });
      if (!report) throw ApiError.notFound('Report');

      // Other publications in the same category, so a report is not a dead end.
      // Excluding itself matters: a "related" list that includes the thing you
      // are already reading looks like a bug, because it is one.
      const related = await req.ctx.prisma.report.findMany({
        where: {
          locale,
          isPublished: true,
          id: { not: report.id },
          ...(report.category ? { category: { slug: report.category.slug } } : {}),
        },
        orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }],
        take: 3,
        select: reportListSelect,
      });

      setPublicCache(res, 300);
      res.json({
        report,
        related,
        alternates: await localeAlternates(req.ctx.prisma, 'report', report.translationGroupId),
      });
    }),
  );

  router.get(
    '/:locale/policies',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const { category } = z.object({ category: z.string().max(80).optional() }).parse(req.query);

      setPublicCache(res, 300);
      res.json({
        categories: await req.ctx.prisma.policyCategory.findMany({
          where: category ? { slug: category } : {},
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            summary: true,
            policies: {
              where: { locale, status: 'PUBLISHED', deletedAt: null },
              orderBy: { title: 'asc' },
              select: policyListSelect,
            },
          },
        }),
      });
    }),
  );

  router.get(
    '/:locale/policies/:slug',
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const policy = await req.ctx.prisma.policy.findFirst({
        where: { locale, slug: req.params.slug, status: 'PUBLISHED', deletedAt: null },
        select: {
          ...policyListSelect,
          body: true,
          seoTitle: true,
          seoDescription: true,
          translationGroupId: true,
          category: { select: { name: true, slug: true } },
          versions: {
            orderBy: { effectiveDate: 'desc' },
            take: 10,
            select: {
              version: true,
              effectiveDate: true,
              supersededAt: true,
              summaryOfChanges: true,
            },
          },
        },
      });
      if (!policy) throw ApiError.notFound('Policy');

      setPublicCache(res, 300);
      res.json({
        policy,
        alternates: await localeAlternates(req.ctx.prisma, 'policy', policy.translationGroupId),
      });
    }),
  );

  return router;
}

// -----------------------------------------------------------------------------
// Projections
// -----------------------------------------------------------------------------

const storyListSelect = {
  id: true,
  kind: true,
  title: true,
  slug: true,
  excerpt: true,
  publishedAt: true,
  readingMinutes: true,
  isFeatured: true,
  category: { select: { name: true, slug: true, family: true } },
  heroImage: { select: imageSelect },
  thumbnail: { select: imageSelect },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
} satisfies Prisma.StorySelect;

const pressReleaseListSelect = {
  id: true,
  headline: true,
  slug: true,
  summary: true,
  dateline: true,
  publishedAt: true,
  isFeatured: true,
  category: { select: { name: true, slug: true } },
  image: { select: imageSelect },
} satisfies Prisma.PressReleaseSelect;

const personListSelect = {
  id: true,
  name: true,
  slug: true,
  role: true,
  roleDetail: true,
  shortBio: true,
  isFeatured: true,
  portrait: { select: imageSelect },
} satisfies Prisma.PersonSelect;

const employeeStoryListSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  personName: true,
  roleLabel: true,
  departmentLabel: true,
  locationLabel: true,
  publishedAt: true,
  isFeatured: true,
  isDemoContent: true,
  portrait: { select: imageSelect },
} satisfies Prisma.EmployeeStorySelect;

const impactStoryListSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  location: true,
  year: true,
  publishedAt: true,
  isFeatured: true,
  isDemoContent: true,
  image: { select: imageSelect },
  pillar: { select: { name: true, slug: true, icon: true } },
} satisfies Prisma.ImpactStorySelect;

const reportListSelect = {
  id: true,
  title: true,
  slug: true,
  year: true,
  type: true,
  description: true,
  publicationDate: true,
  isFeatured: true,
  isDemoContent: true,
  cover: { select: imageSelect },
  category: { select: { name: true, slug: true } },
  files: {
    orderBy: { sortOrder: 'asc' },
    select: {
      label: true,
      locale: true,
      asset: {
        select: { id: true, storageKey: true, mimeType: true, byteSize: true, originalName: true },
      },
    },
  },
} satisfies Prisma.ReportSelect;

const policyListSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  version: true,
  effectiveDate: true,
  publishedAt: true,
  updatedAt: true,
  isDemoContent: true,
  document: {
    select: { id: true, storageKey: true, mimeType: true, byteSize: true, originalName: true },
  },
} satisfies Prisma.PolicySelect;

/**
 * Published locale variants of a record, used for hreflang.
 *
 * Two families, because the platform has two notions of published. Editorial
 * content runs the workflow and is published when its status says so; reports,
 * impact stories and employee stories carry a boolean. Conflating them would
 * advertise an unpublished translation as an alternate.
 */
async function localeAlternates(
  prisma: PrismaClient,
  entity:
    'story' | 'pressRelease' | 'person' | 'policy' | 'report' | 'impactStory' | 'employeeStory',
  translationGroupId: string,
): Promise<Record<string, string>> {
  const workflow = { translationGroupId, deletedAt: null, status: 'PUBLISHED' as const };
  const flagged = { translationGroupId, isPublished: true };
  const select = { locale: true, slug: true } as const;

  const rows =
    entity === 'story'
      ? await prisma.story.findMany({ where: workflow, select })
      : entity === 'pressRelease'
        ? await prisma.pressRelease.findMany({ where: workflow, select })
        : entity === 'person'
          ? await prisma.person.findMany({ where: workflow, select })
          : entity === 'policy'
            ? await prisma.policy.findMany({ where: workflow, select })
            : entity === 'report'
              ? await prisma.report.findMany({ where: flagged, select })
              : entity === 'impactStory'
                ? await prisma.impactStory.findMany({ where: flagged, select })
                : await prisma.employeeStory.findMany({ where: flagged, select });

  return Object.fromEntries(rows.map((row) => [row.locale, row.slug]));
}

/** Distinct publication years, used to build year filters. */
async function availableYears(
  prisma: PrismaClient,
  table: string,
  locale: Locale,
): Promise<number[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ year: number }>>(
    `SELECT DISTINCT EXTRACT(YEAR FROM "publishedAt")::int AS year
     FROM "${table}"
     WHERE "locale" = $1::"Locale" AND "status" = 'PUBLISHED' AND "deletedAt" IS NULL AND "publishedAt" IS NOT NULL
     ORDER BY year DESC`,
    locale,
  );
  return rows.map((row) => row.year);
}
