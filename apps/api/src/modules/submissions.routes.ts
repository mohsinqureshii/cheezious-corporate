import { generateReference, hashIp } from '@cheezious/auth';
import type { Prisma } from '@cheezious/database';
import {
  ApiError,
  consent,
  email as emailSchema,
  optionalHttpUrl,
  optionalString,
  phone as phoneSchema,
  PUBLIC_UPLOAD_MIMES,
  requiredString,
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
 * Public submission endpoints: suppliers, real estate, partnerships and contact.
 *
 * Each one creates a row in a queue that a specific team works in the CMS, which
 * is the point — these are lead pipelines with owners and statuses, not a form
 * that sends an email into a shared inbox and is never seen again.
 *
 * Every endpoint applies the same protections: rate limiting, a honeypot, a
 * timing check, recorded consent, sanitised free text and a hashed IP.
 */

const SPAM_MESSAGE = 'We could not accept this submission.';

/**
 * Reject obvious automation.
 *
 * Silent by design: a bot that learns which check caught it can adapt, so the
 * response is identical to a generic validation failure.
 */
function assertNotSpam(
  input: { contactFax?: string; elapsedMs?: number },
  req: import('express').Request,
  label: string,
): void {
  if (input.contactFax) {
    req.ctx.logger.warn({ ip: clientIp(req), form: label }, 'submission rejected by honeypot');
    throw new ApiError('VALIDATION_ERROR', SPAM_MESSAGE);
  }
  if (typeof input.elapsedMs === 'number' && input.elapsedMs < 3000) {
    req.ctx.logger.warn({ ip: clientIp(req), form: label }, 'submission rejected by timing check');
    throw new ApiError('VALIDATION_ERROR', SPAM_MESSAGE);
  }
}

/** Score free text for spam signals. High scores are quarantined, not discarded. */
function scoreSpam(text: string): number {
  let score = 0;
  const linkCount = (text.match(/https?:\/\//gi) ?? []).length;
  if (linkCount > 3) score += 0.4;
  if (linkCount > 8) score += 0.3;
  if (/\b(viagra|casino|crypto airdrop|seo services|guest post|backlink)\b/i.test(text)) score += 0.5;
  if (text.length > 40 && text === text.toUpperCase()) score += 0.2;
  if (/(.)\1{15,}/.test(text)) score += 0.2;
  return Math.min(1, score);
}

const CONSENT_TEXT = {
  supplier:
    'I consent to Cheezious storing and processing this information to assess a potential supplier relationship.',
  property:
    'I consent to Cheezious storing and processing this information to assess the proposed location.',
  partnership:
    'I consent to Cheezious storing and processing this information to assess a potential partnership.',
  contact: 'I consent to Cheezious storing and processing this information to respond to my enquiry.',
} as const;

const RETENTION_DAYS = { supplier: 730, property: 730, partnership: 365, contact: 365 };

function retentionDate(kind: keyof typeof RETENTION_DAYS): Date {
  return new Date(Date.now() + RETENTION_DAYS[kind] * 24 * 60 * 60 * 1000);
}

export function submissionsRoutes(): Router {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 6, fields: 40 },
  });

  // ---------------------------------------------------------------------------
  // Reference data for the public forms
  // ---------------------------------------------------------------------------

  router.get(
    '/supplier-categories',
    rateLimit('publicRead'),
    asyncHandler(async (req, res) => {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600');
      res.json({
        categories: await req.ctx.prisma.supplierCategory.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, key: true, name: true, slug: true, summary: true },
        }),
      });
    }),
  );

  router.get(
    '/partnership-categories',
    rateLimit('publicRead'),
    asyncHandler(async (req, res) => {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600');
      res.json({
        categories: await req.ctx.prisma.partnershipCategory.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, key: true, name: true, slug: true, summary: true },
        }),
      });
    }),
  );

  /** Contact routing. `routingEmail` is deliberately not selected. */
  router.get(
    '/contact-categories',
    rateLimit('publicRead'),
    asyncHandler(async (req, res) => {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600');
      res.json({
        categories: await req.ctx.prisma.contactCategory.findMany({
          where: { isEnabled: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            key: true,
            name: true,
            slug: true,
            description: true,
            publicInstructions: true,
          },
        }),
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Supplier registration
  // ---------------------------------------------------------------------------

  const supplierSchema = z
    .object({
      companyName: requiredString('Company name', 200),
      website: optionalHttpUrl,
      contactName: requiredString('Contact name', 120),
      email: emailSchema,
      phone: phoneSchema,
      categoryId: z.string().cuid().optional(),
      productsServices: requiredString('Products or services', 4000),
      citiesServed: z.union([z.string(), z.array(z.string())]).optional(),
      certifications: optionalString(2000),
      productionCapacity: optionalString(2000),
      companyProfile: optionalString(4000),
      notes: optionalString(2000),
      consent,
    })
    .merge(spamGuard);

  router.post(
    '/suppliers',
    rateLimit('supplierSubmission'),
    upload.array('attachments', 4),
    asyncHandler(async (req, res) => {
      const body = supplierSchema.parse({
        ...req.body,
        consent: req.body.consent === 'true' || req.body.consent === true,
      });
      assertNotSpam(body, req, 'supplier');

      const { prisma, env } = req.ctx;

      if (body.categoryId) {
        const exists = await prisma.supplierCategory.findFirst({
          where: { id: body.categoryId, isActive: true },
          select: { id: true },
        });
        if (!exists) {
          throw ApiError.validation([{ field: 'categoryId', message: 'Choose a category from the list.' }]);
        }
      }

      const files = await storeAttachments(req, STORAGE_PREFIX.supplierAttachments, env.MAX_APPLICATION_UPLOAD_MB);
      const reference = generateReference('SUP');

      const submission = await prisma.$transaction(async (tx) => {
        const created = await tx.supplierSubmission.create({
          data: {
            reference,
            companyName: body.companyName,
            website: body.website ?? null,
            contactName: body.contactName,
            email: body.email,
            phone: body.phone,
            categoryId: body.categoryId ?? null,
            productsServices: sanitizeHtml(body.productsServices),
            citiesServed: normaliseList(body.citiesServed),
            certifications: body.certifications ? sanitizeHtml(body.certifications) : null,
            productionCapacity: body.productionCapacity ? sanitizeHtml(body.productionCapacity) : null,
            companyProfile: body.companyProfile ? sanitizeHtml(body.companyProfile) : null,
            notes: body.notes ? sanitizeHtml(body.notes) : null,
            consentGivenAt: new Date(),
            consentText: CONSENT_TEXT.supplier,
            ipHash: hashIp(clientIp(req), env.SESSION_SECRET),
            userAgent: req.header('user-agent')?.slice(0, 500) ?? null,
            retentionUntil: retentionDate('supplier'),
          },
          select: { id: true, reference: true },
        });

        for (const file of files) {
          const asset = await tx.mediaAsset.create({
            data: {
              kind: 'DOCUMENT',
              storageKey: file.storageKey,
              originalName: file.originalName,
              mimeType: file.mimeType,
              byteSize: file.byteSize,
              checksum: file.checksum,
              title: `Supplier attachment — ${body.companyName}`,
              visibility: 'RESTRICTED',
            },
            select: { id: true },
          });
          await tx.supplierAttachment.create({
            data: { submissionId: created.id, assetId: asset.id, label: file.originalName },
          });
        }

        return created;
      });

      await recordSubmissionAudit(prisma, 'supplierSubmission', submission.id, submission.reference, body.companyName);

      res.status(201).json({
        ok: true,
        reference: submission.reference,
        message: 'Thank you. Our procurement team will review your submission.',
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Real-estate property submission
  // ---------------------------------------------------------------------------

  const propertySchema = z
    .object({
      contactName: requiredString('Contact name', 120),
      email: emailSchema,
      phone: phoneSchema,
      company: optionalString(200),
      cityName: requiredString('City', 100),
      area: optionalString(120),
      address: requiredString('Address', 500),
      latitude: z.coerce.number().min(-90).max(90).optional(),
      longitude: z.coerce.number().min(-180).max(180).optional(),
      propertyType: z
        .enum([
          'HIGH_STREET',
          'SHOPPING_MALL',
          'STANDALONE',
          'FOOD_COURT',
          'DRIVE_THROUGH',
          'KIOSK',
          'COMMERCIAL_PLAZA',
          'OTHER',
        ])
        .default('HIGH_STREET'),
      totalAreaSqft: z.coerce.number().int().min(0).max(1_000_000).optional(),
      groundFloorSqft: z.coerce.number().int().min(0).max(1_000_000).optional(),
      frontageFeet: z.coerce.number().int().min(0).max(10_000).optional(),
      parkingSpaces: z.coerce.number().int().min(0).max(10_000).optional(),
      driveThroughFeasible: z.coerce.boolean().optional(),
      ownership: z.enum(['OWNER', 'AUTHORISED_AGENT', 'DEVELOPER', 'OTHER']).default('OWNER'),
      expectedRent: optionalString(120),
      availableFrom: z.coerce.date().optional(),
      notes: optionalString(4000),
      consent,
    })
    .merge(spamGuard)
    .refine(
      (v) => v.groundFloorSqft === undefined || v.totalAreaSqft === undefined || v.groundFloorSqft <= v.totalAreaSqft,
      { path: ['groundFloorSqft'], message: 'Ground-floor area cannot exceed the total area.' },
    );

  router.post(
    '/properties',
    rateLimit('propertySubmission'),
    upload.array('attachments', 6),
    asyncHandler(async (req, res) => {
      const body = propertySchema.parse({
        ...req.body,
        consent: req.body.consent === 'true' || req.body.consent === true,
      });
      assertNotSpam(body, req, 'property');

      const { prisma, env } = req.ctx;
      const files = await storeAttachments(req, STORAGE_PREFIX.propertyAttachments, env.MAX_APPLICATION_UPLOAD_MB);
      const reference = generateReference('PRP');

      // Match the submitted city to a known city where possible, so the
      // expansion team can filter by city without cleaning free text.
      const city = await prisma.city.findFirst({
        where: { name: { equals: body.cityName, mode: 'insensitive' } },
        select: { id: true },
      });

      const submission = await prisma.$transaction(async (tx) => {
        const created = await tx.propertySubmission.create({
          data: {
            reference,
            contactName: body.contactName,
            email: body.email,
            phone: body.phone,
            company: body.company ?? null,
            cityId: city?.id ?? null,
            cityName: body.cityName,
            area: body.area ?? null,
            address: sanitizeHtml(body.address),
            latitude: body.latitude ?? null,
            longitude: body.longitude ?? null,
            propertyType: body.propertyType,
            totalAreaSqft: body.totalAreaSqft ?? null,
            groundFloorSqft: body.groundFloorSqft ?? null,
            frontageFeet: body.frontageFeet ?? null,
            parkingSpaces: body.parkingSpaces ?? null,
            driveThroughFeasible: body.driveThroughFeasible ?? null,
            ownership: body.ownership,
            expectedRent: body.expectedRent ?? null,
            availableFrom: body.availableFrom ?? null,
            notes: body.notes ? sanitizeHtml(body.notes) : null,
            consentGivenAt: new Date(),
            consentText: CONSENT_TEXT.property,
            ipHash: hashIp(clientIp(req), env.SESSION_SECRET),
            userAgent: req.header('user-agent')?.slice(0, 500) ?? null,
            retentionUntil: retentionDate('property'),
          },
          select: { id: true, reference: true },
        });

        for (const file of files) {
          const asset = await tx.mediaAsset.create({
            data: {
              kind: file.mimeType.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
              storageKey: file.storageKey,
              originalName: file.originalName,
              mimeType: file.mimeType,
              byteSize: file.byteSize,
              checksum: file.checksum,
              title: `Property attachment — ${body.cityName}`,
              visibility: 'RESTRICTED',
            },
            select: { id: true },
          });
          await tx.propertyAttachment.create({
            data: {
              submissionId: created.id,
              assetId: asset.id,
              kind: file.mimeType.startsWith('image/') ? 'PHOTO' : 'FLOOR_PLAN',
              label: file.originalName,
            },
          });
        }

        return created;
      });

      await recordSubmissionAudit(prisma, 'propertySubmission', submission.id, submission.reference, body.cityName);

      res.status(201).json({
        ok: true,
        reference: submission.reference,
        message: 'Thank you. Our expansion team will review the location.',
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Institutional partnerships
  // ---------------------------------------------------------------------------

  const partnershipSchema = z
    .object({
      organisationName: requiredString('Organisation name', 200),
      website: optionalHttpUrl,
      contactName: requiredString('Contact name', 120),
      email: emailSchema,
      phone: z.string().max(32).optional(),
      role: optionalString(120),
      categoryId: z.string().cuid().optional(),
      proposal: requiredString('Proposal', 5000),
      consent,
    })
    .merge(spamGuard);

  router.post(
    '/partnerships',
    rateLimit('partnershipSubmission'),
    asyncHandler(async (req, res) => {
      const body = partnershipSchema.parse(req.body);
      assertNotSpam(body, req, 'partnership');

      const { prisma, env } = req.ctx;
      const reference = generateReference('PTN');

      const submission = await prisma.partnershipSubmission.create({
        data: {
          reference,
          organisationName: body.organisationName,
          website: body.website ?? null,
          contactName: body.contactName,
          email: body.email,
          phone: body.phone ?? null,
          role: body.role ?? null,
          categoryId: body.categoryId ?? null,
          proposal: sanitizeHtml(body.proposal),
          consentGivenAt: new Date(),
          consentText: CONSENT_TEXT.partnership,
          ipHash: hashIp(clientIp(req), env.SESSION_SECRET),
          userAgent: req.header('user-agent')?.slice(0, 500) ?? null,
          retentionUntil: retentionDate('partnership'),
        },
        select: { id: true, reference: true },
      });

      await recordSubmissionAudit(
        prisma,
        'partnershipSubmission',
        submission.id,
        submission.reference,
        body.organisationName,
      );

      res.status(201).json({
        ok: true,
        reference: submission.reference,
        message: 'Thank you. We will be in touch if there is a fit.',
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Contact
  // ---------------------------------------------------------------------------

  const contactSchema = z
    .object({
      categoryKey: z
        .enum(['CUSTOMER', 'CORPORATE', 'MEDIA', 'CAREERS', 'SUPPLIERS', 'REAL_ESTATE', 'PARTNERSHIPS', 'OTHER'])
        .default('OTHER'),
      name: requiredString('Name', 120),
      email: emailSchema,
      phone: z.string().max(32).optional(),
      city: optionalString(80),
      subject: optionalString(200),
      message: requiredString('Message', 5000),
      consent,
    })
    .merge(spamGuard);

  router.post(
    '/contact',
    rateLimit('contactSubmission'),
    asyncHandler(async (req, res) => {
      const body = contactSchema.parse(req.body);
      assertNotSpam(body, req, 'contact');

      const { prisma, env } = req.ctx;

      const category = await prisma.contactCategory.findFirst({
        where: { key: body.categoryKey, isEnabled: true },
        select: { id: true, name: true },
      });

      const spamScore = scoreSpam(`${body.subject ?? ''} ${body.message}`);
      const reference = generateReference('CON');

      const submission = await prisma.contactSubmission.create({
        data: {
          reference,
          categoryId: category?.id ?? null,
          name: body.name,
          email: body.email,
          phone: body.phone ?? null,
          city: body.city ?? null,
          subject: body.subject ?? null,
          message: sanitizeHtml(body.message),
          consentGivenAt: new Date(),
          consentText: CONSENT_TEXT.contact,
          ipHash: hashIp(clientIp(req), env.SESSION_SECRET),
          userAgent: req.header('user-agent')?.slice(0, 500) ?? null,
          spamScore,
          // A likely-spam message is quarantined for review rather than deleted:
          // false positives on a customer complaint would be worse than noise.
          status: spamScore >= 0.7 ? 'SPAM' : 'NEW',
          retentionUntil: retentionDate('contact'),
        },
        select: { id: true, reference: true },
      });

      await recordSubmissionAudit(
        prisma,
        'contactSubmission',
        submission.id,
        submission.reference,
        category?.name ?? 'General enquiry',
      );

      res.status(201).json({
        ok: true,
        reference: submission.reference,
        message: 'Thank you for getting in touch. We will respond as soon as we can.',
      });
    }),
  );

  return router;
}

interface StoredAttachment {
  storageKey: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  checksum: string;
}

/** Validate and store uploaded attachments, rejecting the whole batch on failure. */
async function storeAttachments(
  req: import('express').Request,
  prefix: string,
  maxMb: number,
): Promise<StoredAttachment[]> {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) return [];

  const maxBytes = maxMb * 1024 * 1024;

  for (const file of files) {
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
        validation.errors.map((message) => ({ field: 'attachments', message: `${file.originalname}: ${message}` })),
      );
    }
  }

  const storage = createStorageDriver(req.ctx.env);
  const stored: StoredAttachment[] = [];

  for (const file of files) {
    const key = buildStorageKey(prefix, file.originalname);
    const result = await storage.put(key, file.buffer, file.mimetype);
    stored.push({
      storageKey: result.storageKey,
      originalName: file.originalname.slice(0, 255),
      mimeType: file.mimetype,
      byteSize: file.size,
      checksum: result.checksum,
    });
  }

  return stored;
}

function normaliseList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const items = Array.isArray(value) ? value : value.split(',');
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((item) => item.slice(0, 80));
}

/** Audit that a submission arrived, without recording its personal data. */
async function recordSubmissionAudit(
  prisma: import('@cheezious/database').PrismaClient,
  entityType: string,
  entityId: string,
  reference: string,
  label: string,
): Promise<void> {
  await new AuditService(prisma).record(
    { email: null, ipAddress: null },
    {
      action: 'CREATE',
      entityType,
      entityId,
      entityLabel: `${reference} — ${label}`,
      summary: 'New public submission received',
      metadata: { reference } as Prisma.InputJsonObject,
    },
  );
}
