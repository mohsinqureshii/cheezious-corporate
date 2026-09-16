import { generateReference, hashIp } from '@cheezious/auth';
import { isLocale, type Locale } from '@cheezious/config';
import type { Prisma } from '@cheezious/database';
import {
  ApiError,
  consent,
  email as emailSchema,
  optionalHttpUrl,
  phone as phoneSchema,
  PUBLIC_UPLOAD_MIMES,
  requiredString,
  optionalString,
  sanitizeHtml,
  spamGuard,
  validateUpload,
} from '@cheezious/validation';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { AuditService } from '../lib/audit';
import { asyncHandler, clientIp, rateLimit } from '../middleware';
import { buildStorageKey, createStorageDriver, STORAGE_PREFIX } from '../services/storage';

/**
 * Careers: public job listings and the application pipeline.
 *
 * Applications are submitted to, validated by and stored by the backend. The
 * browser never writes to storage directly and never decides what is acceptable:
 * file type, size, rate limits, consent and job availability are all enforced
 * here, because anything checked only in the browser is not checked at all.
 */

function parseLocale(value: unknown): Locale {
  if (!isLocale(value)) throw new ApiError('NOT_FOUND', 'Unknown language.');
  return value;
}

function setPublicCache(res: import('express').Response, seconds = 60): void {
  res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 10}`);
}

const jobListSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  employmentType: true,
  workplaceType: true,
  postedAt: true,
  applicationDeadline: true,
  isFeatured: true,
  openingsCount: true,
  category: { select: { name: true, slug: true } },
  department: { select: { name: true, slug: true } },
  location: { select: { name: true, slug: true, isRemote: true, city: { select: { name: true, slug: true } } } },
} satisfies Prisma.JobSelect;

/**
 * A job is publicly visible only when it is OPEN and its deadline has not
 * passed. Expressed once, here, and reused by the list, the detail route and the
 * application endpoint, so a closed job cannot still accept applications.
 */
function openJobFilter(locale: Locale): Prisma.JobWhereInput {
  return {
    locale,
    status: 'OPEN',
    deletedAt: null,
    OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: new Date() } }],
  };
}

export function careersRoutes(): Router {
  const router = Router();

  // ---------------------------------------------------------------------------
  // Public job listings
  // ---------------------------------------------------------------------------

  router.get(
    '/:locale/jobs',
    rateLimit('publicRead'),
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const query = z
        .object({
          q: z.string().max(120).optional(),
          category: z.string().max(80).optional(),
          department: z.string().max(80).optional(),
          location: z.string().max(80).optional(),
          employmentType: z.string().max(40).optional(),
          workplaceType: z.string().max(40).optional(),
          featured: z.coerce.boolean().optional(),
          page: z.coerce.number().int().min(1).max(200).default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(10),
        })
        .parse(req.query);

      const where: Prisma.JobWhereInput = {
        ...openJobFilter(locale),
        ...(query.category ? { category: { slug: query.category } } : {}),
        ...(query.department ? { department: { slug: query.department } } : {}),
        ...(query.location ? { location: { slug: query.location } } : {}),
        ...(query.employmentType ? { employmentType: query.employmentType as never } : {}),
        ...(query.workplaceType ? { workplaceType: query.workplaceType as never } : {}),
        ...(query.featured ? { isFeatured: true } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { summary: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [items, total, facets] = await Promise.all([
        req.ctx.prisma.job.findMany({
          where,
          orderBy: [{ isFeatured: 'desc' }, { postedAt: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: jobListSelect,
        }),
        req.ctx.prisma.job.count({ where }),
        buildJobFacets(req.ctx.prisma, locale),
      ]);

      setPublicCache(res, 60);
      res.json({ items, total, page: query.page, pageSize: query.pageSize, facets });
    }),
  );

  /** Job detail. Supplies everything the JobPosting structured data needs. */
  router.get(
    '/:locale/jobs/:slug',
    rateLimit('publicRead'),
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const job = await req.ctx.prisma.job.findFirst({
        where: { ...openJobFilter(locale), slug: req.params.slug },
        select: {
          ...jobListSelect,
          description: true,
          responsibilities: true,
          requirements: true,
          preferredQualifications: true,
          benefits: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          salaryPeriod: true,
          seoTitle: true,
          seoDescription: true,
          noindex: true,
          updatedAt: true,
          translationGroupId: true,
          location: {
            select: {
              name: true,
              slug: true,
              isRemote: true,
              city: { select: { name: true, slug: true, region: { select: { name: true } } } },
            },
          },
          // The application form definition, so the public form is CMS-driven.
          formDefinition: {
            select: {
              id: true,
              key: true,
              successMessage: true,
              submitLabel: true,
              isEnabled: true,
              fields: {
                orderBy: { sortOrder: 'asc' },
                select: {
                  type: true,
                  name: true,
                  label: true,
                  placeholder: true,
                  helpText: true,
                  isRequired: true,
                  options: true,
                  validation: true,
                  width: true,
                },
              },
            },
          },
        },
      });
      if (!job) throw ApiError.notFound('Job');

      const alternates = await req.ctx.prisma.job.findMany({
        where: { translationGroupId: job.translationGroupId, status: 'OPEN', deletedAt: null },
        select: { locale: true, slug: true },
      });

      setPublicCache(res, 60);
      res.json({
        job,
        alternates: Object.fromEntries(alternates.map((alt) => [alt.locale, alt.slug])),
        similar: await req.ctx.prisma.job.findMany({
          where: {
            ...openJobFilter(locale),
            NOT: { id: job.id },
            OR: [
              ...(job.category ? [{ category: { slug: job.category.slug } }] : []),
              ...(job.department ? [{ department: { slug: job.department.slug } }] : []),
            ],
          },
          take: 4,
          orderBy: { postedAt: 'desc' },
          select: jobListSelect,
        }),
      });
    }),
  );

  router.get(
    '/:locale/careers/categories',
    rateLimit('publicRead'),
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);

      const categories = await req.ctx.prisma.careerCategory.findMany({
        where: { isPublished: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          key: true,
          name: true,
          slug: true,
          summary: true,
          description: true,
          _count: { select: { jobs: { where: openJobFilter(locale) } } },
        },
      });

      setPublicCache(res, 120);
      res.json({
        categories: categories.map(({ _count, ...category }) => ({ ...category, openRoles: _count.jobs })),
      });
    }),
  );

  router.get(
    '/:locale/careers/filters',
    rateLimit('publicRead'),
    asyncHandler(async (req, res) => {
      setPublicCache(res, 120);
      res.json({ facets: await buildJobFacets(req.ctx.prisma, parseLocale(req.params.locale)) });
    }),
  );

  // ---------------------------------------------------------------------------
  // Job application submission
  // ---------------------------------------------------------------------------

  /**
   * Upload limits are enforced by multer before a byte reaches a handler, and
   * again by `validateUpload` once the bytes are in memory — the first stops a
   * large upload early, the second catches a spoofed content type.
   */
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 2, fields: 30 },
  });

  const applicationSchema = z
    .object({
      firstName: requiredString('First name', 80),
      lastName: requiredString('Last name', 80),
      email: emailSchema,
      phone: phoneSchema,
      city: optionalString(80),
      linkedinUrl: optionalHttpUrl,
      portfolioUrl: optionalHttpUrl,
      coverNote: optionalString(5000),
      /** Answers to job-specific configurable fields, sent as a JSON string. */
      answers: z.string().max(20_000).optional(),
      consent,
    })
    .merge(spamGuard);

  router.post(
    '/:locale/jobs/:slug/apply',
    rateLimit('jobApplication'),
    upload.fields([
      { name: 'cv', maxCount: 1 },
      { name: 'portfolio', maxCount: 1 },
    ]),
    asyncHandler(async (req, res) => {
      const locale = parseLocale(req.params.locale);
      const { prisma, env, logger } = req.ctx;

      const body = applicationSchema.parse({
        ...req.body,
        consent: req.body.consent === 'true' || req.body.consent === true,
      });

      // Honeypot and timing checks. Both are silent: a bot learns nothing from
      // being told why it was refused.
      if (body.website) {
        logger.warn({ ip: clientIp(req) }, 'application rejected by honeypot');
        throw new ApiError('VALIDATION_ERROR', 'We could not accept this submission.');
      }
      if (typeof body.elapsedMs === 'number' && body.elapsedMs < 3000) {
        logger.warn({ ip: clientIp(req), elapsedMs: body.elapsedMs }, 'application rejected by timing check');
        throw new ApiError('VALIDATION_ERROR', 'We could not accept this submission.');
      }

      // Re-check availability at submission time: a job may have closed while
      // the form was open in a tab.
      const job = await prisma.job.findFirst({
        where: { ...openJobFilter(locale), slug: req.params.slug },
        select: { id: true, title: true, applicationDeadline: true, formDefinition: { select: { fields: true } } },
      });
      if (!job) {
        throw new ApiError('CONFLICT', 'This role is no longer accepting applications.');
      }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const cv = files?.cv?.[0];
      if (!cv) {
        throw ApiError.validation([{ field: 'cv', message: 'Attach your CV to apply.' }]);
      }

      const maxBytes = env.MAX_APPLICATION_UPLOAD_MB * 1024 * 1024;
      const attachments: Array<{ file: Express.Multer.File; kind: string }> = [{ file: cv, kind: 'CV' }];
      if (files?.portfolio?.[0]) attachments.push({ file: files.portfolio[0], kind: 'PORTFOLIO' });

      for (const { file, kind } of attachments) {
        const validation = validateUpload(
          {
            filename: file.originalname,
            mimeType: file.mimetype,
            byteSize: file.size,
            head: new Uint8Array(file.buffer.subarray(0, 16)),
          },
          { maxBytes, allowedMimes: PUBLIC_UPLOAD_MIMES },
        );
        if (!validation.valid) {
          throw ApiError.validation(
            validation.errors.map((message) => ({ field: kind === 'CV' ? 'cv' : 'portfolio', message })),
          );
        }
      }

      // Duplicate guard: the same person applying twice to the same role within
      // a day is almost always a double submit, not genuine interest.
      const recentDuplicate = await prisma.jobApplication.findFirst({
        where: {
          jobId: job.id,
          email: body.email,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { reference: true },
      });
      if (recentDuplicate) {
        res.status(200).json({
          ok: true,
          reference: recentDuplicate.reference,
          message: 'We already have your application for this role.',
          duplicate: true,
        });
        return;
      }

      const storage = createStorageDriver(env);
      const reference = generateReference('APP');

      // Files are written to private storage before the record is created, so a
      // stored application always has its attachments.
      const stored: Array<{ kind: string; storageKey: string; file: Express.Multer.File; checksum: string }> = [];
      for (const { file, kind } of attachments) {
        const key = buildStorageKey(STORAGE_PREFIX.applications, file.originalname);
        const result = await storage.put(key, file.buffer, file.mimetype);
        stored.push({ kind, storageKey: result.storageKey, file, checksum: result.checksum });
      }

      const consentText =
        'I consent to Cheezious storing and processing the information in this application for recruitment purposes.';

      const application = await prisma.$transaction(async (tx) => {
        const created = await tx.jobApplication.create({
          data: {
            jobId: job.id,
            reference,
            firstName: body.firstName,
            lastName: body.lastName,
            email: body.email,
            phone: body.phone,
            city: body.city ?? null,
            linkedinUrl: body.linkedinUrl ?? null,
            portfolioUrl: body.portfolioUrl ?? null,
            coverNote: body.coverNote ? sanitizeHtml(body.coverNote) : null,
            answers: parseAnswers(body.answers),
            consentGivenAt: new Date(),
            consentText,
            source: 'CORPORATE_SITE',
            // The raw IP is never stored; a salted hash supports abuse
            // investigation without retaining a network identifier.
            ipHash: hashIp(clientIp(req), env.SESSION_SECRET),
            userAgent: req.header('user-agent')?.slice(0, 500) ?? null,
            // Default retention: 12 months from submission.
            retentionUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
          select: { id: true, reference: true },
        });

        for (const item of stored) {
          const asset = await tx.mediaAsset.create({
            data: {
              kind: 'DOCUMENT',
              storageKey: item.storageKey,
              originalName: item.file.originalname.slice(0, 255),
              mimeType: item.file.mimetype,
              byteSize: item.file.size,
              checksum: item.checksum,
              title: `${item.kind} — ${body.firstName} ${body.lastName}`,
              // Applicant files are never publicly downloadable.
              visibility: 'RESTRICTED',
            },
            select: { id: true },
          });

          await tx.jobApplicationFile.create({
            data: { applicationId: created.id, assetId: asset.id, kind: item.kind },
          });
        }

        return created;
      });

      // The audit entry records that an application arrived, not who sent it.
      await new AuditService(prisma).record(
        { email: null, ipAddress: null },
        {
          action: 'CREATE',
          entityType: 'jobApplication',
          entityId: application.id,
          entityLabel: `Application ${application.reference}`,
          summary: `New application for "${job.title}"`,
          metadata: { jobId: job.id, reference: application.reference },
        },
      );

      logger.info({ jobId: job.id, reference: application.reference }, 'job application received');

      res.status(201).json({
        ok: true,
        reference: application.reference,
        message: 'Your application has been received. Keep this reference for your records.',
      });
    }),
  );

  return router;
}

/** Parse configurable-field answers defensively; malformed JSON is dropped. */
function parseAnswers(raw: string | undefined): Prisma.InputJsonValue | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;

    const entries = Object.entries(parsed as Record<string, unknown>)
      .slice(0, 40)
      .map(([key, value]) => [
        key.slice(0, 80),
        typeof value === 'string' ? value.slice(0, 2000) : value,
      ]);

    return Object.fromEntries(entries) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

async function buildJobFacets(prisma: import('@cheezious/database').PrismaClient, locale: Locale) {
  const where = openJobFilter(locale);

  const [categories, departments, locations, byType, byWorkplace] = await Promise.all([
    prisma.careerCategory.findMany({
      where: { jobs: { some: where } },
      orderBy: { sortOrder: 'asc' },
      select: { name: true, slug: true, _count: { select: { jobs: { where } } } },
    }),
    prisma.department.findMany({
      where: { jobs: { some: where } },
      orderBy: { sortOrder: 'asc' },
      select: { name: true, slug: true, _count: { select: { jobs: { where } } } },
    }),
    prisma.jobLocation.findMany({
      where: { jobs: { some: where } },
      orderBy: { sortOrder: 'asc' },
      select: { name: true, slug: true, isRemote: true, _count: { select: { jobs: { where } } } },
    }),
    prisma.job.groupBy({ by: ['employmentType'], where, _count: true }),
    prisma.job.groupBy({ by: ['workplaceType'], where, _count: true }),
  ]);

  return {
    categories: categories.map(({ _count, ...c }) => ({ ...c, count: _count.jobs })),
    departments: departments.map(({ _count, ...d }) => ({ ...d, count: _count.jobs })),
    locations: locations.map(({ _count, ...l }) => ({ ...l, count: _count.jobs })),
    employmentTypes: byType.map((row) => ({ value: row.employmentType, count: row._count })),
    workplaceTypes: byWorkplace.map((row) => ({ value: row.workplaceType, count: row._count })),
  };
}
