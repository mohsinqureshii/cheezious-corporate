import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

import { ApiError } from '@cheezious/validation';
import { Router } from 'express';

import { asyncHandler } from '../middleware';
import { isPrivateKey, resolveStorageRoot } from '../services/storage';

/**
 * Media delivery.
 *
 * Serves uploaded files when the local storage driver is in use — development
 * and self-hosted deployments. With the S3 driver, files are served directly
 * from object storage and this route is never reached.
 *
 * The security rules here are absolute:
 *
 *   1. **Private keys are never served.** Applicant CVs, supplier documents and
 *      property attachments live under a `private/` prefix and this route
 *      refuses them outright, regardless of what the database says. Getting a
 *      CV out requires an authenticated, permission-checked CMS request.
 *   2. **Path traversal is impossible.** The resolved path must sit inside the
 *      storage root, checked after resolution rather than by inspecting the
 *      request for `..`.
 *   3. **Content types are allow-listed.** A stored file is served as a known
 *      safe type or not at all, so an unexpected upload cannot be served as
 *      something the browser will execute.
 */

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export function mediaRoutes(): Router {
  const router = Router();

  router.get(
    /^\/(.+)$/,
    asyncHandler(async (req, res) => {
      const key = decodeURIComponent((req.params as unknown as string[])[0] ?? '');

      // Personal data is never served from a public route, whatever the key.
      if (!key || isPrivateKey(key)) throw ApiError.notFound('File');

      const { env } = req.ctx;
      if (env.STORAGE_DRIVER !== 'local') {
        // With object storage the CDN serves files directly; reaching here means
        // a misconfigured base URL rather than a missing file.
        throw ApiError.notFound('File');
      }

      const root = resolveStorageRoot(env.STORAGE_LOCAL_ROOT);
      const target = path.resolve(root, key);

      // Traversal check after resolution: inspecting the raw request for ".."
      // misses encoded and normalised variants.
      if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        req.ctx.logger.warn({ key }, 'blocked media path traversal attempt');
        throw ApiError.notFound('File');
      }

      const extension = path.extname(target).toLowerCase();
      const contentType = CONTENT_TYPES[extension];
      if (!contentType) throw ApiError.notFound('File');

      let stats;
      try {
        stats = await stat(target);
      } catch {
        throw ApiError.notFound('File');
      }
      if (!stats.isFile()) throw ApiError.notFound('File');

      // Storage keys carry a random component and are immutable, so a long
      // cache lifetime is safe: replacing an asset produces a new key.
      const etag = `"${stats.size.toString(16)}-${stats.mtimeMs.toString(16)}"`;
      if (req.header('if-none-match') === etag) {
        res.status(304).end();
        return;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(stats.size));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // An uploaded SVG is script-capable; forcing a download prevents it being
      // rendered as a document in the browser's origin.
      if (extension === '.svg') res.setHeader('Content-Disposition', 'attachment');

      createReadStream(target).pipe(res);
    }),
  );

  return router;
}
