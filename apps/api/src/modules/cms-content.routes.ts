import { PAGINATION } from '@cheezious/config';
import type { Prisma } from '@cheezious/database';
import {
  availableTransitions,
  STATUS_META,
  type ContentStatus,
  type Permission,
  type WorkflowAction,
} from '@cheezious/permissions';
import { slugify } from '@cheezious/utilities';
import { ApiError, sanitizeHtml } from '@cheezious/validation';
import { Router } from 'express';
import { z } from 'zod';

import { AuditService } from '../lib/audit';
import { asyncHandler, clientIp, param, rateLimit, requireAuth, requirePermission } from '../middleware';
import { VersioningService } from '../services/versioning';
import { WorkflowService } from '../services/workflow';

import { COLLECTIONS, type CollectionConfig } from './collections';

/**
 * CMS structured content.
 *
 * Everything the corporate site publishes that is not a composed page — stories,
 * news, press releases, people, policies, jobs, and the curated reference lists
 * behind them — is managed through one implementation, configured per collection
 * in `collections.ts`.
 *
 * That is deliberate rather than clever. Fourteen hand-written CRUD modules
 * would diverge: one would forget to soft-delete, one would forget to audit, one
 * would let an author publish. Here, "an author cannot publish" is written once
 * and is true of every collection that declares a workflow.
 *
 * Two shapes exist, because two genuinely different things are being modelled:
 *
 *   - **Editorial collections** carry the full workflow — draft and published
 *     are separate records, transitions are guarded, and history is versioned.
 *     A story, a press release or a job posting is a document with an author, a
 *     reviewer and a publication moment.
 *
 *   - **Reference collections** are curated lists: awards, timeline milestones,
 *     categories, departments. They carry a publish flag and a sort order,
 *     because "is this shown, and where in the list" is the whole of their
 *     lifecycle. They are still audited and still permission-checked.
 */

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(PAGINATION.cmsDefaultPageSize),
  q: z.string().max(200).optional(),
  status: z.string().max(200).optional(),
  locale: z.enum(['en', 'ur']).optional(),
  published: z.enum(['true', 'false']).optional(),
  categoryId: z.string().cuid().optional(),
  hasUnpublishedChanges: z.coerce.boolean().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  sortBy: z.string().max(40).optional(),
});

const transitionInput = z.object({
  action: z.enum([
    'SUBMIT_FOR_REVIEW',
    'APPROVE',
    'REQUEST_CHANGES',
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

export function cmsContentRoutes(): Router {
  const router = Router();
  router.use(requireAuth());

  for (const config of COLLECTIONS) registerCollection(router, config);

  return router;
}

/** A Prisma delegate, reached generically. Every collection uses the same shape. */
interface Delegate {
  findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
  count: (args: unknown) => Promise<number>;
  groupBy: (args: unknown) => Promise<Array<{ status?: string; _count: number }>>;
  create: (args: unknown) => Promise<Record<string, unknown>>;
  update: (args: unknown) => Promise<Record<string, unknown>>;
  delete: (args: unknown) => Promise<Record<string, unknown>>;
}

function delegateFor(prisma: unknown, model: string): Delegate {
  return (prisma as Record<string, unknown>)[model] as Delegate;
}

function registerCollection(router: Router, config: CollectionConfig): void {
  const base = `/${config.path}`;

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  router.get(
    base,
    requirePermission(config.permissions.read),
    asyncHandler(async (req, res) => {
      const query = listQuery.parse(req.query);
      const model = delegateFor(req.ctx.prisma, config.model);

      const where = buildWhere(config, query);
      const orderBy = buildOrderBy(config, query);

      const [items, total] = await Promise.all([
        model.findMany({
          where,
          orderBy,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: config.listSelect,
        }),
        model.count({ where }),
      ]);

      // Facets are counted over the whole collection rather than the current
      // filter, so the numbers beside each status do not change as you filter.
      const facets = config.workflow
        ? await model
            .groupBy({ by: ['status'], where: baseWhere(config), _count: true })
            .then((rows) =>
              rows.map((row) => ({
                value: row.status as string,
                label: STATUS_META[row.status as ContentStatus]?.label ?? (row.status as string),
                count: row._count,
              })),
            )
        : [];

      res.json({
        items,
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
        facets: { statuses: facets },
        collection: describe(config),
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Read one
  // ---------------------------------------------------------------------------

  router.get(
    `${base}/:id`,
    requirePermission(config.permissions.read),
    asyncHandler(async (req, res) => {
      const record = await delegateFor(req.ctx.prisma, config.model).findFirst({
        where: { id: param(req, 'id'), ...(config.softDelete ? { deletedAt: null } : {}) },
        ...(config.detailSelect ? { select: config.detailSelect } : {}),
      });
      if (!record) throw ApiError.notFound(config.label);

      res.json({
        item: record,
        collection: describe(config),
        ...(config.workflow
          ? {
              transitions: availableTransitions(
                record.status as ContentStatus,
                config.permissionPrefix,
                (permission) => req.ability.can(permission),
              ),
            }
          : {}),
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  router.post(
    base,
    requirePermission(config.permissions.create),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = config.createSchema.parse(req.body) as Record<string, unknown>;
      const model = delegateFor(req.ctx.prisma, config.model);

      const data = await prepareWrite(config, input, req, { creating: true });

      const record = await model.create({
        data,
        ...(config.detailSelect ? { select: config.detailSelect } : {}),
      });

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'CREATE',
          entityType: config.entityType,
          entityId: record.id as string,
          entityLabel: String(record[config.labelField] ?? ''),
          summary: `Created ${config.label.toLowerCase()}`,
        },
      );

      res.status(201).json({ item: record });
    }),
  );

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  router.patch(
    `${base}/:id`,
    requirePermission(config.permissions.update),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = config.updateSchema.parse(req.body) as Record<string, unknown>;
      const model = delegateFor(req.ctx.prisma, config.model);

      const existing = await model.findFirst({
        where: { id: param(req, 'id'), ...(config.softDelete ? { deletedAt: null } : {}) },
        ...(config.detailSelect ? { select: config.detailSelect } : {}),
      });
      if (!existing) throw ApiError.notFound(config.label);

      const data = await prepareWrite(config, input, req, { creating: false, existing });

      // An edit to a published record does not touch what the public site
      // serves: that is the published snapshot. It is flagged instead, so the
      // editor can see there is something waiting to go live.
      if (config.workflow && existing.publishedVersionId) {
        (data as Record<string, unknown>).hasUnpublishedChanges = true;
      }

      const updated = await model.update({
        where: { id: existing.id as string },
        data,
        ...(config.detailSelect ? { select: config.detailSelect } : {}),
      });

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'UPDATE',
          entityType: config.entityType,
          entityId: existing.id as string,
          entityLabel: String(updated[config.labelField] ?? ''),
          summary: `Updated ${config.label.toLowerCase()}`,
          before: pickAudited(config, existing),
          after: pickAudited(config, updated),
        },
      );

      res.json({ item: updated });
    }),
  );

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  router.delete(
    `${base}/:id`,
    requirePermission(config.permissions.delete),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const model = delegateFor(req.ctx.prisma, config.model);

      const existing = await model.findFirst({
        where: { id: param(req, 'id'), ...(config.softDelete ? { deletedAt: null } : {}) },
        select: {
          id: true,
          [config.labelField]: true,
          ...(config.slugField ? { [config.slugField]: true } : {}),
          ...(config.workflow ? { status: true } : {}),
        },
      });
      if (!existing) throw ApiError.notFound(config.label);

      // Published content is never deleted out from under the public site: it
      // has to be unpublished first, deliberately, by someone who may publish.
      if (config.workflow && existing.status === 'PUBLISHED') {
        throw new ApiError(
          'INVALID_TRANSITION',
          `This ${config.label.toLowerCase()} is published. Unpublish it before deleting it.`,
        );
      }

      if (config.softDelete) {
        // The slug is released as well as the record. The unique constraint
        // counts soft-deleted rows, so leaving it in place would reserve that
        // address forever — someone would delete a draft called "Annual
        // Report" and never be able to use the name again.
        const released = config.slugField
          ? { [config.slugField]: `${String(existing[config.slugField] ?? existing.id)}-deleted-${Date.now()}`.slice(0, 190) }
          : {};

        await model.update({
          where: { id: existing.id as string },
          data: { deletedAt: new Date(), ...released },
        });
      } else {
        await model.delete({ where: { id: existing.id as string } });
      }

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'DELETE',
          entityType: config.entityType,
          entityId: existing.id as string,
          entityLabel: String(existing[config.labelField] ?? ''),
          summary: config.softDelete
            ? `Deleted ${config.label.toLowerCase()} (recoverable)`
            : `Deleted ${config.label.toLowerCase()}`,
        },
      );

      res.status(204).end();
    }),
  );

  if (!config.workflow) return;

  // ---------------------------------------------------------------------------
  // Workflow, versions and restore — editorial collections only
  // ---------------------------------------------------------------------------

  router.post(
    `${base}/:id/transition`,
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = transitionInput.parse(req.body);
      const model = delegateFor(req.ctx.prisma, config.model);

      const record = await model.findFirst({
        where: { id: param(req, 'id'), ...(config.softDelete ? { deletedAt: null } : {}) },
        ...(config.detailSelect ? { select: config.detailSelect } : {}),
      });
      if (!record) throw ApiError.notFound(config.label);

      const workflow = new WorkflowService(req.ctx.prisma);

      const request = {
        entityType: config.entityType,
        entityId: record.id as string,
        action: input.action as WorkflowAction,
        currentStatus: record.status as ContentStatus,
        scheduledFor: input.scheduledFor ?? null,
        note: input.note ?? null,
        // The snapshot is the working copy: what the public site will serve once
        // this is published, and nothing else.
        snapshot: snapshotOf(config, record),
        entityLabel: String(record[config.labelField] ?? ''),
      };

      workflow.assertAllowed(request, req.ability);

      const actor = { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) };

      const outcome = await req.ctx.prisma.$transaction(async (tx) => {
        const result = await workflow.apply(request, actor, tx, {
          wasEverPublished: record.publishedAt !== null && record.publishedAt !== undefined,
        });

        await delegateFor(tx, config.model).update({
          where: { id: record.id as string },
          data: {
            status: result.status,
            ...(result.publishedVersionId !== undefined
              ? { publishedVersionId: result.publishedVersionId, hasUnpublishedChanges: false }
              : {}),
            ...(result.publishedAt !== undefined && config.hasPublishedAt
              ? { publishedAt: result.publishedAt }
              : {}),
            ...(result.scheduledFor !== undefined ? { scheduledFor: result.scheduledFor } : {}),
          },
        });

        await workflow.notify(request, result.status, req.principal!.id, tx, {
          authorId: (record.createdById as string | null) ?? null,
          reviewerIds: await reviewerIdsFor(tx, config.permissions.publish),
        });

        return result;
      });

      res.json({ status: outcome.status, scheduledFor: outcome.scheduledFor ?? null });
    }),
  );

  router.get(
    `${base}/:id/versions`,
    requirePermission(config.permissions.read),
    asyncHandler(async (req, res) => {
      res.json({
        versions: await new VersioningService(req.ctx.prisma).listVersions(
          config.entityType,
          param(req, 'id'),
          50,
        ),
      });
    }),
  );

  router.post(
    `${base}/:id/versions/:versionId/restore`,
    requirePermission(config.permissions.update),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const id = param(req, 'id');
      const versionId = param(req, 'versionId');
      const model = delegateFor(req.ctx.prisma, config.model);

      const version = await req.ctx.prisma.contentVersion.findFirst({
        where: { id: versionId, entityType: config.entityType, entityId: id },
      });
      if (!version) throw ApiError.notFound('Version');

      const existing = await model.findFirst({
        where: { id, ...(config.softDelete ? { deletedAt: null } : {}) },
        ...(config.detailSelect ? { select: config.detailSelect } : {}),
      });
      if (!existing) throw ApiError.notFound(config.label);

      const snapshot = version.data as Record<string, unknown>;
      // Restoring writes a new revision rather than rewinding: the history
      // between then and now is still there afterwards.
      const restorable = Object.fromEntries(
        config.versionedFields.filter((field) => field in snapshot).map((field) => [field, snapshot[field]]),
      );

      const updated = await req.ctx.prisma.$transaction(async (tx) => {
        const record = await delegateFor(tx, config.model).update({
          where: { id },
          data: {
            ...restorable,
            ...(existing.publishedVersionId ? { hasUnpublishedChanges: true } : {}),
            ...(config.hasUpdatedBy ? { updatedById: req.principal!.id } : {}),
          },
          ...(config.detailSelect ? { select: config.detailSelect } : {}),
        });

        await new VersioningService(req.ctx.prisma).createVersion(
          {
            entityType: config.entityType,
            entityId: id,
            data: snapshotOf(config, record),
            status: record.status as ContentStatus,
            createdById: req.principal!.id,
            note: `Restored from version ${version.versionNumber}`,
            restoredFromVersionId: version.id,
          },
          tx,
        );

        return record;
      });

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'RESTORE',
          entityType: config.entityType,
          entityId: id,
          entityLabel: String(updated[config.labelField] ?? ''),
          summary: `Restored version ${version.versionNumber} as a new revision`,
        },
      );

      res.json({ item: updated });
    }),
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** The filter every query starts from: nothing deleted, nothing from another kind. */
function baseWhere(config: CollectionConfig): Record<string, unknown> {
  return {
    ...(config.softDelete ? { deletedAt: null } : {}),
    ...(config.fixedWhere ?? {}),
  };
}

function buildWhere(config: CollectionConfig, query: z.infer<typeof listQuery>): Record<string, unknown> {
  return {
    ...baseWhere(config),
    ...(query.locale && config.localized ? { locale: query.locale } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(config.workflow && query.status ? { status: { in: query.status.split(',') } } : {}),
    ...(config.publishFlag && query.published
      ? { [config.publishFlag]: query.published === 'true' }
      : {}),
    ...(config.workflow && query.hasUnpublishedChanges ? { hasUnpublishedChanges: true } : {}),
    ...(query.q
      ? {
          OR: config.searchFields.map((field) => ({
            [field]: { contains: query.q, mode: 'insensitive' },
          })),
        }
      : {}),
  };
}

function buildOrderBy(config: CollectionConfig, query: z.infer<typeof listQuery>): Record<string, string> {
  const field = query.sortBy && config.sortableFields.includes(query.sortBy) ? query.sortBy : config.defaultSort;
  return { [field]: query.sortDir };
}

/**
 * Turn validated input into a Prisma write.
 *
 * Three things happen here that must happen for every collection: rich text is
 * sanitised, slugs are derived and kept unique within their locale, and the
 * authorship columns are set from the session rather than the request body.
 */
async function prepareWrite(
  config: CollectionConfig,
  input: Record<string, unknown>,
  req: Parameters<Parameters<typeof asyncHandler>[0]>[0],
  options: { creating: boolean; existing?: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = { ...input };

  // Some values are a publishing act in field's clothing — setting a job's
  // status to Open puts it on the careers site. Those values require the
  // publishing permission even though the route itself only requires the
  // permission to edit.
  for (const guard of config.guardedFields ?? []) {
    const value = data[guard.field];
    if (typeof value === 'string' && guard.values.includes(value) && !req.ability.can(guard.permission)) {
      throw new ApiError(
        'FORBIDDEN',
        `You do not have permission to set ${config.label.toLowerCase()} ${guard.field} to ${value.toLowerCase()}.`,
      );
    }
  }

  // Rich text is stored sanitised, so a stored payload can never become an
  // injection at render time regardless of which surface renders it.
  for (const field of config.richTextFields) {
    if (typeof data[field] === 'string') data[field] = sanitizeHtml(data[field] as string);
  }

  if (config.slugField) {
    const label = (data[config.labelField] ?? options.existing?.[config.labelField]) as string | undefined;
    const requested = (data[config.slugField] as string | undefined) ?? (options.creating ? label : undefined);

    if (requested) {
      const locale = (data.locale ?? options.existing?.locale ?? 'en') as string;
      data[config.slugField] = await uniqueSlug(
        req.ctx.prisma,
        config,
        slugify(requested),
        locale,
        options.existing?.id as string | undefined,
      );
    }
  }

  if (options.creating) {
    // The key is derived once, on create, and never rewritten afterwards:
    // renaming a category must not silently break whatever refers to it.
    if (config.deriveKeyFromSlug && !data.key) {
      data.key = (data[config.slugField ?? 'slug'] as string | undefined) ?? slugify(String(data[config.labelField] ?? ''));
    }

    // A new record starts its own translation group; linking a translation is a
    // separate, explicit action.
    if (config.localized && !data.translationGroupId) {
      data.translationGroupId = (data.translationOfGroupId as string | undefined) ?? crypto.randomUUID();
    }
    delete data.translationOfGroupId;
    if (config.hasCreatedBy) data.createdById = req.principal!.id;
  }

  if (config.hasUpdatedBy) data.updatedById = req.principal!.id;

  return data;
}

/**
 * A slug that is unique within its locale.
 *
 * Collisions are resolved by suffixing rather than rejected, because an editor
 * naming the third "Annual Report" of the year should not have to invent a URL.
 */
async function uniqueSlug(
  prisma: unknown,
  config: CollectionConfig,
  base: string,
  locale: string,
  excludeId?: string,
): Promise<string> {
  const model = delegateFor(prisma, config.model);
  const candidateBase = base || 'untitled';

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? candidateBase : `${candidateBase}-${attempt + 1}`;
    const clash = await model.findFirst({
      where: {
        [config.slugField as string]: candidate,
        ...(config.localized ? { locale } : {}),
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return candidate;
  }

  // Fifty taken variants means something is wrong with the input, not the data.
  throw ApiError.validation([{ field: config.slugField as string, message: 'Choose a different, more specific title.' }]);
}

/** The fields captured in a version and published to the public site. */
function snapshotOf(config: CollectionConfig, record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(config.versionedFields.map((field) => [field, record[field] ?? null]));
}

/** The fields worth diffing in the audit log — never the whole record. */
function pickAudited(config: CollectionConfig, record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(config.auditedFields.map((field) => [field, record[field] ?? null]));
}

/** Who to tell when something is submitted for review. */
async function reviewerIdsFor(tx: Prisma.TransactionClient, publishPermission: Permission): Promise<string[]> {
  const users = await tx.user.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      roles: { some: { role: { permissions: { some: { permission: { key: publishPermission } } } } } },
    },
    select: { id: true },
    take: 25,
  });
  return users.map((user) => user.id);
}

/** What the CMS needs to render a collection it has not been hand-coded for. */
function describe(config: CollectionConfig) {
  return {
    path: config.path,
    label: config.label,
    labelPlural: config.labelPlural,
    labelField: config.labelField,
    slugField: config.slugField,
    workflow: config.workflow,
    localized: config.localized,
    publishFlag: config.publishFlag ?? null,
    sortableFields: config.sortableFields,
    fields: config.fields,
  };
}
