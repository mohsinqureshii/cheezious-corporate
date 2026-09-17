import { checkDatabaseConnection } from '@cheezious/database';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import type { AppContext } from './lib/context';
import {
  accessLog,
  asyncHandler,
  authenticate,
  errorHandler,
  notFoundHandler,
  requestContext,
} from './middleware';
import { authRoutes } from './modules/auth.routes';
import { careersRoutes } from './modules/careers.routes';
import { cmsContentRoutes } from './modules/cms-content.routes';
import { cmsDashboardRoutes } from './modules/cms-dashboard.routes';
import { cmsMediaRoutes } from './modules/cms-media.routes';
import { cmsPagesRoutes } from './modules/cms-pages.routes';
import { cmsStructureRoutes } from './modules/cms-structure.routes';
import { cmsSubmissionsRoutes } from './modules/cms-submissions.routes';
import { cmsSystemRoutes } from './modules/cms-system.routes';
import { mediaRoutes } from './modules/media.routes';
import { publicContentRoutes } from './modules/public-content.routes';
import { publicRoutes } from './modules/public.routes';
import { submissionsRoutes } from './modules/submissions.routes';

/**
 * API composition.
 *
 * The route tree makes the security boundary explicit:
 *   /api/public/**   — anonymous reads, published content only
 *   /api/submit/**   — anonymous writes, heavily rate limited
 *   /api/auth/**     — session lifecycle
 *   /api/cms/**      — authenticated, permission-checked management
 */
export function createApp(ctx: AppContext): Express {
  const app = express();

  // Behind one reverse proxy in every supported deployment. Trusting more hops
  // than actually exist would let a client spoof its own IP for rate limiting.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API serves JSON and media, never HTML pages, so a restrictive
      // default CSP is safe here. The public site sets its own.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts:
        ctx.env.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Server-to-server calls and same-origin requests carry no Origin.
        if (!origin) return callback(null, true);

        const allowed = ctx.env.CORS_ALLOWED_ORIGINS;
        if (allowed.length === 0 || allowed.includes(origin)) return callback(null, true);

        ctx.logger.warn({ origin }, 'CORS origin rejected');
        callback(new Error('Origin not allowed'));
      },
      // Credentials are required so the CMS session cookie is sent.
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      // `Cache-Control` is not CORS-safelisted, so a client sending it needs it
      // named here or every one of its requests fails preflight.
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Cache-Control',
        'x-request-id',
        'x-internal-key',
      ],
      exposedHeaders: [
        'x-request-id',
        'x-ratelimit-limit',
        'x-ratelimit-remaining',
        'x-ratelimit-reset',
      ],
      maxAge: 600,
    }),
  );

  // A 1 MB JSON limit is generous for content payloads and small enough that a
  // malicious body cannot exhaust memory. Uploads go through multer separately.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(requestContext(ctx));
  app.use(accessLog());
  app.use(authenticate());

  // --- Health -------------------------------------------------------------
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'cheezious-api', timestamp: new Date().toISOString() });
  });

  /** Readiness: only report ready when the database is actually reachable. */
  app.get(
    '/ready',
    asyncHandler(async (req, res) => {
      const databaseReachable = await checkDatabaseConnection(req.ctx.prisma);
      res.status(databaseReachable ? 200 : 503).json({
        status: databaseReachable ? 'ready' : 'degraded',
        checks: { database: databaseReachable ? 'ok' : 'unreachable' },
        timestamp: new Date().toISOString(),
      });
    }),
  );

  // --- Routes -------------------------------------------------------------
  app.use('/api/auth', authRoutes());
  app.use('/api/public', publicRoutes());
  app.use('/api/public', publicContentRoutes());
  app.use('/api/public', careersRoutes());
  app.use('/api/submit', submissionsRoutes());

  // Management API. Every route beneath requires a session and a permission.
  app.use('/api/cms/dashboard', cmsDashboardRoutes());
  app.use('/api/cms/pages', cmsPagesRoutes());
  app.use('/api/cms/content', cmsContentRoutes());
  app.use('/api/cms/media', cmsMediaRoutes());
  app.use('/api/cms/submissions', cmsSubmissionsRoutes());
  app.use('/api/cms/structure', cmsStructureRoutes());
  app.use('/api/cms/system', cmsSystemRoutes());

  // File delivery for the local storage driver. Mounted outside /api because
  // these are assets, not API responses, and are cached very differently.
  app.use('/files', mediaRoutes());

  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
