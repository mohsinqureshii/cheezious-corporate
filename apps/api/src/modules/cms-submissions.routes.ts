import { Prisma } from '@cheezious/database';
import { ApiError } from '@cheezious/validation';
import { Router } from 'express';
import { z } from 'zod';

import { AuditService } from '../lib/audit';
import { asyncHandler, clientIp, param, rateLimit, requireAuth, requirePermission } from '../middleware';

/**
 * Submission queues.
 *
 * These are the screens the business actually runs on: HR working applications,
 * Procurement qualifying suppliers, Expansion reviewing properties. Each queue
 * is a pipeline with an owner, a status and private notes — not an inbox.
 *
 * Every route here touches personal data, so three rules apply throughout:
 *
 *   1. Reading requires an explicit permission, and the queues are separate
 *      permissions, so Procurement cannot read job applications.
 *   2. Internal notes and assignee comments are never exposed publicly and are
 *      recorded in the audit log by reference, never by content.
 *   3. Exports are a distinct, higher-risk permission, because bulk extraction
 *      of applicant data is a materially different act from reviewing one
 *      application.
 */

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().max(200).optional(),
  status: z.string().max(200).optional(),
  assigneeId: z.string().cuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

const noteInput = z.object({ body: z.string().min(1).max(4000) });

export function cmsSubmissionsRoutes(): Router {
  const router = Router();
  router.use(requireAuth());

  // ===========================================================================
  // Job applications
  // ===========================================================================

  const applicationStatus = z.enum([
    'NEW',
    'REVIEWING',
    'SHORTLISTED',
    'INTERVIEW',
    'OFFER',
    'HIRED',
    'REJECTED',
    'WITHDRAWN',
  ]);

  router.get(
    '/applications',
    requirePermission('applications.read'),
    asyncHandler(async (req, res) => {
      const query = listQuery.extend({ jobId: z.string().cuid().optional() }).parse(req.query);

      const where: Prisma.JobApplicationWhereInput = {
        deletedAt: null,
        ...(query.jobId ? { jobId: query.jobId } : {}),
        ...(query.status ? { status: { in: query.status.split(',') as never } } : {}),
        ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
        ...(query.from || query.to
          ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
          : {}),
        ...(query.q
          ? {
              OR: [
                { firstName: { contains: query.q, mode: 'insensitive' } },
                { lastName: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q, mode: 'insensitive' } },
                { reference: { contains: query.q.toUpperCase() } },
              ],
            }
          : {}),
      };

      const [items, total, statusCounts] = await Promise.all([
        req.ctx.prisma.jobApplication.findMany({
          where,
          orderBy: { createdAt: query.sortDir },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            id: true,
            reference: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            city: true,
            status: true,
            rating: true,
            createdAt: true,
            job: { select: { id: true, title: true, slug: true } },
            assignee: { select: { id: true, name: true } },
            _count: { select: { files: true, notes: true } },
          },
        }),
        req.ctx.prisma.jobApplication.count({ where }),
        req.ctx.prisma.jobApplication.groupBy({
          by: ['status'],
          where: { deletedAt: null, ...(query.jobId ? { jobId: query.jobId } : {}) },
          _count: true,
        }),
      ]);

      res.json({
        items,
        meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
        facets: { statuses: statusCounts.map((row) => ({ value: row.status, count: row._count })) },
      });
    }),
  );

  router.get(
    '/applications/:id',
    requirePermission('applications.read'),
    asyncHandler(async (req, res) => {
      const application = await req.ctx.prisma.jobApplication.findFirst({
        where: { id: param(req, 'id'), deletedAt: null },
        include: {
          job: { select: { id: true, title: true, slug: true, department: { select: { name: true } } } },
          assignee: { select: { id: true, name: true, email: true } },
          files: {
            include: { asset: { select: { id: true, originalName: true, mimeType: true, byteSize: true, storageKey: true } } },
          },
          notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, name: true } } } },
        },
      });
      if (!application) throw ApiError.notFound('Application');

      // Reading an application is itself auditable: this is personal data, and
      // "who looked at this candidate" is a question that must be answerable.
      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'UPDATE',
          entityType: 'jobApplication',
          entityId: application.id,
          entityLabel: application.reference,
          summary: 'Viewed application',
        },
      );

      res.json({ application });
    }),
  );

  /** Download an applicant's CV. Permission-checked and audited. */
  router.get(
    '/applications/:id/files/:fileId',
    requirePermission('applications.read'),
    asyncHandler(async (req, res) => {
      const file = await req.ctx.prisma.jobApplicationFile.findFirst({
        where: { id: param(req, 'fileId'), applicationId: param(req, 'id') },
        include: {
          asset: { select: { storageKey: true, originalName: true, mimeType: true } },
          application: { select: { reference: true, deletedAt: true } },
        },
      });
      if (!file || file.application.deletedAt) throw ApiError.notFound('File');

      const { createStorageDriver } = await import('../services/storage');
      const storage = createStorageDriver(req.ctx.env);

      let buffer: Buffer;
      try {
        buffer = await storage.get(file.asset.storageKey);
      } catch {
        throw ApiError.notFound('File');
      }

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'EXPORT',
          entityType: 'jobApplication',
          entityId: param(req, 'id'),
          entityLabel: file.application.reference,
          summary: `Downloaded ${file.kind}`,
        },
      );

      res.setHeader('Content-Type', file.asset.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.asset.originalName)}"`);
      // Personal data is never cached by an intermediary.
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(buffer);
    }),
  );

  router.patch(
    '/applications/:id',
    requirePermission('applications.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = z
        .object({
          status: applicationStatus.optional(),
          assigneeId: z.string().cuid().nullish(),
          rating: z.number().int().min(1).max(5).nullish(),
        })
        .parse(req.body);

      const existing = await req.ctx.prisma.jobApplication.findFirst({
        where: { id: param(req, 'id'), deletedAt: null },
        select: { id: true, reference: true, status: true, assigneeId: true },
      });
      if (!existing) throw ApiError.notFound('Application');

      const updated = await req.ctx.prisma.jobApplication.update({
        where: { id: existing.id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
          ...(input.rating !== undefined ? { rating: input.rating } : {}),
        },
        select: { id: true, status: true, assigneeId: true, rating: true },
      });

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'STATUS_CHANGED',
          entityType: 'jobApplication',
          entityId: existing.id,
          entityLabel: existing.reference,
          summary:
            input.status && input.status !== existing.status
              ? `Status changed from ${existing.status} to ${input.status}`
              : 'Updated application',
          // Only the status transition is recorded — never the applicant's data.
          before: { status: existing.status },
          after: { status: updated.status },
        },
      );

      res.json({ application: updated });
    }),
  );

  router.post(
    '/applications/:id/notes',
    requirePermission('applications.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const { body } = noteInput.parse(req.body);

      const application = await req.ctx.prisma.jobApplication.findFirst({
        where: { id: param(req, 'id'), deletedAt: null },
        select: { id: true },
      });
      if (!application) throw ApiError.notFound('Application');

      const note = await req.ctx.prisma.submissionNote.create({
        data: { jobApplicationId: application.id, authorId: req.principal!.id, body },
        include: { author: { select: { id: true, name: true } } },
      });

      res.status(201).json({ note });
    }),
  );

  /**
   * Who a submission can be assigned to.
   *
   * Deliberately available to anyone who can read a queue, rather than gated
   * behind user administration: someone working the Procurement inbox needs to
   * hand a supplier to a colleague without also being able to manage accounts.
   * It returns names and ids only.
   */
  router.get(
    '/assignees',
    asyncHandler(async (req, res) => {
      const queuePermissions = [
        'applications.manage',
        'suppliers.manage',
        'properties.manage',
        'partnerships.manage',
        'contact.manage',
      ] as const;

      const held = queuePermissions.filter((permission) => req.ability.can(permission));
      if (held.length === 0) {
        throw new ApiError('FORBIDDEN', 'You do not work any submission queue.');
      }

      const users = await req.ctx.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          roles: { some: { role: { permissions: { some: { permission: { key: { in: [...held] } } } } } } },
        },
        orderBy: { name: 'asc' },
        take: 100,
        select: { id: true, name: true },
      });

      res.json({ assignees: users });
    }),
  );

  // ===========================================================================
  // Supplier, property, partnership and contact queues
  //
  // Built from one generic factory: the four queues differ in their fields and
  // their permissions, not in how a queue behaves. Writing them four times would
  // guarantee they drift apart.
  // ===========================================================================

  registerQueue(router, {
    path: '/suppliers',
    model: 'supplierSubmission',
    readPermission: 'suppliers.read',
    managePermission: 'suppliers.manage',
    exportPermission: 'suppliers.export',
    label: 'Supplier submission',
    statuses: ['NEW', 'REVIEWING', 'QUALIFIED', 'CONTACTED', 'APPROVED', 'REJECTED', 'ARCHIVED'],
    searchFields: ['companyName', 'contactName', 'email', 'reference'],
    listSelect: {
      id: true,
      reference: true,
      companyName: true,
      contactName: true,
      email: true,
      phone: true,
      citiesServed: true,
      status: true,
      createdAt: true,
      category: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      _count: { select: { attachments: true, notesLog: true } },
    },
    noteField: 'supplierSubmissionId',
    attachmentModel: 'supplierAttachment',
  });

  registerQueue(router, {
    path: '/properties',
    model: 'propertySubmission',
    readPermission: 'properties.read',
    managePermission: 'properties.manage',
    exportPermission: 'properties.export',
    label: 'Property submission',
    statuses: ['NEW', 'REVIEWING', 'INTERESTING', 'SITE_VISIT', 'ACCEPTED', 'REJECTED', 'ARCHIVED'],
    searchFields: ['contactName', 'email', 'cityName', 'reference'],
    listSelect: {
      id: true,
      reference: true,
      contactName: true,
      email: true,
      phone: true,
      cityName: true,
      area: true,
      propertyType: true,
      totalAreaSqft: true,
      status: true,
      createdAt: true,
      assignee: { select: { id: true, name: true } },
      _count: { select: { attachments: true, notesLog: true } },
    },
    noteField: 'propertySubmissionId',
    attachmentModel: 'propertyAttachment',
  });

  registerQueue(router, {
    path: '/partnerships',
    model: 'partnershipSubmission',
    readPermission: 'partnerships.read',
    managePermission: 'partnerships.manage',
    label: 'Partnership enquiry',
    statuses: ['NEW', 'REVIEWING', 'IN_DISCUSSION', 'ACCEPTED', 'DECLINED', 'ARCHIVED'],
    searchFields: ['organisationName', 'contactName', 'email', 'reference'],
    listSelect: {
      id: true,
      reference: true,
      organisationName: true,
      contactName: true,
      email: true,
      status: true,
      createdAt: true,
      category: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      _count: { select: { notesLog: true } },
    },
    noteField: 'partnershipSubmissionId',
  });

  registerQueue(router, {
    path: '/contact',
    model: 'contactSubmission',
    readPermission: 'contact.read',
    managePermission: 'contact.manage',
    label: 'Contact submission',
    statuses: ['NEW', 'IN_PROGRESS', 'ANSWERED', 'CLOSED', 'SPAM'],
    searchFields: ['name', 'email', 'subject', 'reference'],
    listSelect: {
      id: true,
      reference: true,
      name: true,
      email: true,
      subject: true,
      city: true,
      status: true,
      spamScore: true,
      createdAt: true,
      category: { select: { id: true, name: true, key: true } },
      assignee: { select: { id: true, name: true } },
      _count: { select: { notesLog: true } },
    },
    noteField: 'contactSubmissionId',
  });

  return router;
}

interface QueueConfig {
  path: string;
  model: 'supplierSubmission' | 'propertySubmission' | 'partnershipSubmission' | 'contactSubmission';
  readPermission: import('@cheezious/permissions').Permission;
  managePermission: import('@cheezious/permissions').Permission;
  exportPermission?: import('@cheezious/permissions').Permission;
  label: string;
  statuses: string[];
  searchFields: string[];
  listSelect: Record<string, unknown>;
  noteField: 'supplierSubmissionId' | 'propertySubmissionId' | 'partnershipSubmissionId' | 'contactSubmissionId';
  /** The join model holding this queue's uploaded files, where it has any. */
  attachmentModel?: 'supplierAttachment' | 'propertyAttachment';
}

/**
 * Register a submission queue.
 *
 * One implementation, four queues. Filters, status transitions, assignment,
 * internal notes and auditing behave identically everywhere, which is what stops
 * the Procurement queue quietly acquiring a bug the Expansion queue does not
 * have.
 */
function registerQueue(router: Router, config: QueueConfig): void {
  const statusEnum = z.enum(config.statuses as [string, ...string[]]);

  router.get(
    config.path,
    requirePermission(config.readPermission),
    asyncHandler(async (req, res) => {
      const query = listQuery.parse(req.query);
      const model = req.ctx.prisma[config.model] as never as {
        findMany: (args: unknown) => Promise<unknown[]>;
        count: (args: unknown) => Promise<number>;
        groupBy: (args: unknown) => Promise<Array<{ status: string; _count: number }>>;
      };

      const where: Record<string, unknown> = {
        deletedAt: null,
        ...(query.status ? { status: { in: query.status.split(',') } } : {}),
        ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
        ...(query.from || query.to
          ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
          : {}),
        ...(query.q
          ? {
              OR: config.searchFields.map((field) =>
                field === 'reference'
                  ? { reference: { contains: query.q!.toUpperCase() } }
                  : { [field]: { contains: query.q, mode: 'insensitive' } },
              ),
            }
          : {}),
      };

      const [items, total, statusCounts] = await Promise.all([
        model.findMany({
          where,
          orderBy: { createdAt: query.sortDir },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: config.listSelect,
        }),
        model.count({ where }),
        model.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
      ]);

      res.json({
        items,
        meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
        facets: { statuses: statusCounts.map((row) => ({ value: row.status, count: row._count })) },
      });
    }),
  );

  router.get(
    `${config.path}/:id`,
    requirePermission(config.readPermission),
    asyncHandler(async (req, res) => {
      const model = req.ctx.prisma[config.model] as never as {
        findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      };

      const submission = await model.findFirst({
        where: { id: param(req, 'id'), deletedAt: null },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          notesLog: { orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, name: true } } } },
          ...(config.model === 'supplierSubmission' || config.model === 'propertySubmission'
            ? {
                attachments: {
                  include: {
                    asset: { select: { id: true, originalName: true, mimeType: true, byteSize: true } },
                  },
                },
              }
            : {}),
          ...(config.model !== 'contactSubmission' && config.model !== 'propertySubmission'
            ? { category: { select: { id: true, name: true } } }
            : {}),
        },
      });
      if (!submission) throw ApiError.notFound(config.label);

      res.json({ submission });
    }),
  );

  router.patch(
    `${config.path}/:id`,
    requirePermission(config.managePermission),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = z
        .object({ status: statusEnum.optional(), assigneeId: z.string().cuid().nullish() })
        .parse(req.body);

      const model = req.ctx.prisma[config.model] as never as {
        findFirst: (args: unknown) => Promise<{ id: string; reference: string; status: string } | null>;
        update: (args: unknown) => Promise<Record<string, unknown>>;
      };

      const existing = await model.findFirst({
        where: { id: param(req, 'id'), deletedAt: null },
        select: { id: true, reference: true, status: true },
      });
      if (!existing) throw ApiError.notFound(config.label);

      const updated = await model.update({
        where: { id: existing.id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
        },
        select: { id: true, status: true, assigneeId: true },
      });

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'STATUS_CHANGED',
          entityType: config.model,
          entityId: existing.id,
          entityLabel: existing.reference,
          summary:
            input.status && input.status !== existing.status
              ? `Status changed from ${existing.status} to ${input.status}`
              : `Updated ${config.label.toLowerCase()}`,
          before: { status: existing.status },
          after: { status: (updated.status as string) ?? existing.status },
        },
      );

      res.json({ submission: updated });
    }),
  );

  if (config.attachmentModel) {
    /**
     * Download an attachment.
     *
     * Served through the API rather than from a public URL, because these files
     * are personal data belonging to whoever submitted them. The request is
     * permission-checked, never cached by an intermediary, and audited — a
     * download of someone's documents is an event worth being able to account
     * for later.
     */
    router.get(
      `${config.path}/:id/files/:fileId`,
      requirePermission(config.readPermission),
      asyncHandler(async (req, res) => {
        const attachments = req.ctx.prisma[config.attachmentModel!] as never as {
          findFirst: (args: unknown) => Promise<{
            id: string;
            asset: { storageKey: string; originalName: string; mimeType: string };
            submission: { reference: string; deletedAt: Date | null };
          } | null>;
        };

        const attachment = await attachments.findFirst({
          where: { id: param(req, 'fileId'), submissionId: param(req, 'id') },
          include: {
            asset: { select: { storageKey: true, originalName: true, mimeType: true } },
            submission: { select: { reference: true, deletedAt: true } },
          },
        });
        if (!attachment || attachment.submission.deletedAt) throw ApiError.notFound('File');

        const { createStorageDriver } = await import('../services/storage');

        let buffer: Buffer;
        try {
          buffer = await createStorageDriver(req.ctx.env).get(attachment.asset.storageKey);
        } catch {
          throw ApiError.notFound('File');
        }

        await new AuditService(req.ctx.prisma).record(
          { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
          {
            action: 'EXPORT',
            entityType: config.model,
            entityId: param(req, 'id'),
            entityLabel: attachment.submission.reference,
            summary: 'Downloaded an attachment',
          },
        );

        res.setHeader('Content-Type', attachment.asset.mimeType);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(attachment.asset.originalName)}"`,
        );
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(buffer);
      }),
    );
  }

  router.post(
    `${config.path}/:id/notes`,
    requirePermission(config.managePermission),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const { body } = noteInput.parse(req.body);

      const note = await req.ctx.prisma.submissionNote.create({
        data: { [config.noteField]: param(req, 'id'), authorId: req.principal!.id, body } as never,
        include: { author: { select: { id: true, name: true } } },
      });

      res.status(201).json({ note });
    }),
  );

  /**
   * CSV export.
   *
   * A separate, higher-risk permission: extracting a queue in bulk is a
   * materially different act from reviewing one record, and it is audited as
   * such with the row count.
   */
  if (config.exportPermission) {
    router.get(
      `${config.path}/export`,
      requirePermission(config.exportPermission),
      asyncHandler(async (req, res) => {
        const model = req.ctx.prisma[config.model] as never as {
          findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
        };

        const rows = await model.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5000,
          select: config.listSelect,
        });

        await new AuditService(req.ctx.prisma).record(
          { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
          {
            action: 'EXPORT',
            entityType: config.model,
            summary: `Exported ${rows.length} ${config.label.toLowerCase()} record(s)`,
            metadata: { rowCount: rows.length },
          },
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${config.model}-${Date.now()}.csv"`);
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(toCsv(rows));
      }),
    );
  }
}

/**
 * Serialise rows to CSV.
 *
 * Values beginning with `=`, `+`, `-` or `@` are prefixed with an apostrophe:
 * without it, a spreadsheet interprets a submitted value as a formula, which is
 * a real attack against anyone who opens an exported file.
 */
function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';

  const flatten = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(flatten).join('; ');
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return String(record.name ?? record.title ?? JSON.stringify(record));
    }
    return String(value);
  };

  const escape = (value: string): string => {
    const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
  };

  const headers = Object.keys(rows[0]!).filter((key) => key !== '_count');
  const lines = [headers.map(escape).join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => escape(flatten(row[header]))).join(','));
  }

  return `﻿${lines.join('\r\n')}`;
}
