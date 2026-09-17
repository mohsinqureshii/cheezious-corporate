import { PAGINATION } from '@cheezious/config';
import type { Prisma } from '@cheezious/database';
import { ApiError, findFileType, sanitizeFilename, validateUpload } from '@cheezious/validation';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { AuditService } from '../lib/audit';
import {
  asyncHandler,
  clientIp,
  param,
  rateLimit,
  requireAuth,
  requirePermission,
} from '../middleware';
import { buildStorageKey, createStorageDriver, STORAGE_PREFIX } from '../services/storage';

/**
 * The media library.
 *
 * A digital asset manager rather than an upload box. Three decisions are worth
 * stating:
 *
 *   1. **Uploads are validated three ways.** The declared MIME type, the file
 *      extension and the leading bytes must all agree, so neither a renamed
 *      executable nor a lying client gets through.
 *
 *   2. **Alternative text is a first-class field, not an afterthought.** The
 *      library reports which assets are missing it, because an image without it
 *      is unusable to a screen reader and the site's accessibility is the sum of
 *      these small omissions.
 *
 *   3. **Deletion is refused while an asset is in use.** Nothing that is on a
 *      published page can be removed by accident; the API says where it is used
 *      so the editor can decide.
 */

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(PAGINATION.cmsDefaultPageSize),
  q: z.string().max(200).optional(),
  kind: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER']).optional(),
  folderId: z.string().cuid().optional(),
  visibility: z.enum(['PUBLIC_DOWNLOAD', 'CMS_ONLY', 'RESTRICTED']).optional(),
  brandOnly: z.coerce.boolean().optional(),
  pressOnly: z.coerce.boolean().optional(),
  missingAltText: z.coerce.boolean().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

const metadataInput = z.object({
  title: z.string().min(1).max(200).optional(),
  altText: z.string().max(500).nullish(),
  caption: z.string().max(1000).nullish(),
  credit: z.string().max(200).nullish(),
  copyright: z.string().max(200).nullish(),
  usageNotes: z.string().max(1000).nullish(),
  folderId: z.string().cuid().nullish(),
  visibility: z.enum(['PUBLIC_DOWNLOAD', 'CMS_ONLY', 'RESTRICTED']).optional(),
  isBrandAsset: z.boolean().optional(),
  isPressAsset: z.boolean().optional(),
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
});

const ASSET_SELECT = {
  id: true,
  kind: true,
  storageKey: true,
  originalName: true,
  mimeType: true,
  byteSize: true,
  width: true,
  height: true,
  title: true,
  altText: true,
  caption: true,
  credit: true,
  copyright: true,
  visibility: true,
  isBrandAsset: true,
  isPressAsset: true,
  focalX: true,
  focalY: true,
  placeholderColor: true,
  createdAt: true,
  updatedAt: true,
  folder: { select: { id: true, name: true } },
  uploadedBy: { select: { id: true, name: true } },
  _count: { select: { usages: true } },
} satisfies Prisma.MediaAssetSelect;

/**
 * What the library is allowed to contain.
 *
 * Files submitted by the public — a CV, a supplier's certificate, a property
 * owner's floor plan — are stored as media assets so they share one storage
 * abstraction, but they are personal data belonging to a submission, not
 * library material. They are reachable only through the submission queue that
 * owns them, under that queue's own permission, and are never listed, edited or
 * deleted here.
 *
 * Both halves of this filter matter. The key prefix is what the upload code
 * controls; the relation checks are what remain true if a future upload path
 * forgets the prefix.
 */
const LIBRARY_SCOPE = {
  deletedAt: null,
  NOT: { storageKey: { startsWith: 'private/' } },
  applicationFiles: { none: {} },
  supplierAttachments: { none: {} },
  propertyAttachments: { none: {} },
  formSubmissionFiles: { none: {} },
} satisfies Prisma.MediaAssetWhereInput;

/** Images the CMS accepts. Wider than the public allow-list, still not anything. */
const CMS_UPLOAD_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
];

export function cmsMediaRoutes(): Router {
  const router = Router();
  router.use(requireAuth());

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  });

  // ---------------------------------------------------------------------------
  // Library
  // ---------------------------------------------------------------------------

  router.get(
    '/',
    requirePermission('media.read'),
    asyncHandler(async (req, res) => {
      const query = listQuery.parse(req.query);

      const where: Prisma.MediaAssetWhereInput = {
        ...LIBRARY_SCOPE,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.folderId ? { folderId: query.folderId } : {}),
        ...(query.visibility ? { visibility: query.visibility } : {}),
        ...(query.brandOnly ? { isBrandAsset: true } : {}),
        ...(query.pressOnly ? { isPressAsset: true } : {}),
        // Only images need alternative text; a PDF does not have any.
        ...(query.missingAltText
          ? { kind: 'IMAGE', OR: [{ altText: null }, { altText: '' }] }
          : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { originalName: { contains: query.q, mode: 'insensitive' } },
                { altText: { contains: query.q, mode: 'insensitive' } },
                { caption: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [items, total, kindCounts, missingAltText] = await Promise.all([
        req.ctx.prisma.mediaAsset.findMany({
          where,
          orderBy: { createdAt: query.sortDir },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: ASSET_SELECT,
        }),
        req.ctx.prisma.mediaAsset.count({ where }),
        req.ctx.prisma.mediaAsset.groupBy({ by: ['kind'], where: LIBRARY_SCOPE, _count: true }),
        req.ctx.prisma.mediaAsset.count({
          where: { ...LIBRARY_SCOPE, kind: 'IMAGE', OR: [{ altText: null }, { altText: '' }] },
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
          kinds: kindCounts.map((row) => ({ value: row.kind, count: row._count })),
          missingAltText,
        },
      });
    }),
  );

  router.get(
    '/folders',
    requirePermission('media.read'),
    asyncHandler(async (req, res) => {
      res.json({
        folders: await req.ctx.prisma.mediaFolder.findMany({
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            parentId: true,
            _count: { select: { assets: true } },
          },
        }),
      });
    }),
  );

  router.get(
    '/:id',
    requirePermission('media.read'),
    asyncHandler(async (req, res) => {
      const asset = await req.ctx.prisma.mediaAsset.findFirst({
        where: { id: param(req, 'id'), ...LIBRARY_SCOPE },
        select: {
          ...ASSET_SELECT,
          usages: {
            take: 50,
            select: { id: true, entityType: true, entityId: true, field: true },
          },
        },
      });
      if (!asset) throw ApiError.notFound('Asset');

      res.json({ asset });
    }),
  );

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  router.post(
    '/',
    requirePermission('media.upload'),
    rateLimit('cmsWrite'),
    upload.array('files', 10),
    asyncHandler(async (req, res) => {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) {
        throw ApiError.validation([
          { field: 'files', message: 'Choose at least one file to upload.' },
        ]);
      }

      const folderId =
        typeof req.body.folderId === 'string' && req.body.folderId ? req.body.folderId : null;

      // The whole batch is validated before anything is written, so a bad file
      // at the end cannot leave half an upload behind.
      for (const file of files) {
        const validation = validateUpload(
          {
            filename: file.originalname,
            mimeType: file.mimetype,
            byteSize: file.size,
            head: new Uint8Array(file.buffer.subarray(0, 16)),
          },
          { maxBytes: 25 * 1024 * 1024, allowedMimes: CMS_UPLOAD_MIMES },
        );
        if (!validation.valid) {
          throw ApiError.validation(
            validation.errors.map((message) => ({
              field: 'files',
              message: `${sanitizeFilename(file.originalname)}: ${message}`,
            })),
          );
        }
      }

      const storage = createStorageDriver(req.ctx.env);
      const created: Array<Record<string, unknown>> = [];

      for (const file of files) {
        const key = buildStorageKey(STORAGE_PREFIX.media, file.originalname);
        const stored = await storage.put(key, file.buffer, file.mimetype);
        const type = findFileType(file.mimetype);

        const asset = await req.ctx.prisma.mediaAsset.create({
          data: {
            kind: type?.kind ?? 'OTHER',
            folderId,
            storageKey: stored.storageKey,
            originalName: sanitizeFilename(file.originalname).slice(0, 255),
            mimeType: file.mimetype,
            byteSize: file.size,
            checksum: stored.checksum,
            // The filename is only a starting point; the editor is expected to
            // give the asset a title that means something.
            title: titleFrom(file.originalname),
            visibility: 'CMS_ONLY',
            uploadedById: req.principal!.id,
          },
          select: ASSET_SELECT,
        });

        created.push(asset);
      }

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'CREATE',
          entityType: 'mediaAsset',
          entityId: created[0]?.id as string,
          entityLabel: `${created.length} file(s)`,
          summary: `Uploaded ${created.length} file(s)`,
        },
      );

      res.status(201).json({ items: created });
    }),
  );

  // ---------------------------------------------------------------------------
  // Metadata and deletion
  // ---------------------------------------------------------------------------

  router.patch(
    '/:id',
    requirePermission('media.update'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = metadataInput.strict().parse(req.body);

      const existing = await req.ctx.prisma.mediaAsset.findFirst({
        where: { id: param(req, 'id'), ...LIBRARY_SCOPE },
        select: { id: true, title: true, altText: true, visibility: true, isBrandAsset: true },
      });
      if (!existing) throw ApiError.notFound('Asset');

      if (input.isBrandAsset !== undefined && !req.ability.can('media.manageBrandAssets')) {
        throw new ApiError('FORBIDDEN', 'You do not have permission to change brand assets.');
      }

      const updated = await req.ctx.prisma.mediaAsset.update({
        where: { id: existing.id },
        data: input as Prisma.MediaAssetUncheckedUpdateInput,
        select: ASSET_SELECT,
      });

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'UPDATE',
          entityType: 'mediaAsset',
          entityId: existing.id,
          entityLabel: updated.title,
          summary: 'Updated asset details',
          before: existing,
          after: {
            title: updated.title,
            altText: updated.altText,
            visibility: updated.visibility,
            isBrandAsset: updated.isBrandAsset,
          },
        },
      );

      res.json({ asset: updated });
    }),
  );

  router.delete(
    '/:id',
    requirePermission('media.delete'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const asset = await req.ctx.prisma.mediaAsset.findFirst({
        where: { id: param(req, 'id'), ...LIBRARY_SCOPE },
        select: {
          id: true,
          title: true,
          _count: { select: { usages: true } },
          usages: { take: 5, select: { entityType: true, entityId: true, field: true } },
        },
      });
      if (!asset) throw ApiError.notFound('Asset');

      if (asset._count.usages > 0) {
        throw new ApiError(
          'CONFLICT',
          `This asset is used in ${asset._count.usages} place(s). Remove it from those first.`,
          asset.usages.map((usage) => ({
            field: 'usages',
            message: `${usage.entityType} ${usage.entityId}${usage.field ? ` (${usage.field})` : ''}`,
          })),
        );
      }

      // Soft-deleted: the file stays in storage until a retention job removes
      // it, so an accidental delete is recoverable.
      await req.ctx.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { deletedAt: new Date() },
      });

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'DELETE',
          entityType: 'mediaAsset',
          entityId: asset.id,
          entityLabel: asset.title,
          summary: 'Deleted asset (recoverable)',
        },
      );

      res.status(204).end();
    }),
  );

  return router;
}

/** A first-guess title from a filename: readable, not a slug. */
function titleFrom(filename: string): string {
  return (
    sanitizeFilename(filename)
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200) || 'Untitled asset'
  );
}
