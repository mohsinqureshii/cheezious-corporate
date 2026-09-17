import { randomUUID } from 'node:crypto';

import { RATE_LIMITS, resolveSession, type RateLimitName } from '@cheezious/auth';
import {
  AuthenticationError,
  AuthorizationError,
  createAbility,
  InvalidTransitionError,
  type Ability,
  type Permission,
  type Principal,
} from '@cheezious/permissions';
import { ApiError, fromZodError } from '@cheezious/validation';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import type { AppContext } from '../lib/context';

/**
 * Request-scoped state.
 *
 * `ability` is always present — for an anonymous request it is an ability that
 * permits nothing — so a handler can never forget to check authorisation by
 * forgetting that `principal` might be undefined.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      ctx: AppContext;
      principal: Principal | null;
      sessionId: string | null;
      ability: Ability;
    }
  }
}

export const SESSION_COOKIE = 'cheezious_cms_session';

/** Attach a request id and the application context to every request. */
export function requestContext(ctx: AppContext) {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.requestId = (req.header('x-request-id') ?? randomUUID()).slice(0, 64);
    req.ctx = ctx;
    req.principal = null;
    req.sessionId = null;
    req.ability = createAbility(null);
    res.setHeader('x-request-id', req.requestId);
    next();
  };
}

/** Structured access logging with request timing. */
export function accessLog() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

      req.ctx.logger[level](
        {
          requestId: req.requestId,
          method: req.method,
          path: req.route?.path ?? req.path,
          status: res.statusCode,
          durationMs: Math.round(durationMs * 10) / 10,
          actorId: req.principal?.id,
        },
        'request',
      );
    });

    next();
  };
}

/**
 * Resolve the session cookie into a principal.
 *
 * This never rejects: an invalid or absent session simply leaves the request
 * anonymous. Refusing the request is the job of `requireAuth` and
 * `requirePermission`, which produce the correct 401 or 403.
 */
export function authenticate() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = readSessionCookie(req);
    if (!token) return next();

    try {
      const resolved = await resolveSession(req.ctx.prisma, token, {
        ttlHours: req.ctx.env.SESSION_TTL_HOURS,
        idleTimeoutMinutes: req.ctx.env.SESSION_IDLE_TIMEOUT_MINUTES,
      });

      if (resolved) {
        req.principal = resolved.principal;
        req.sessionId = resolved.sessionId;
        req.ability = createAbility(resolved.principal);
      }
    } catch (error) {
      req.ctx.logger.error({ err: error, requestId: req.requestId }, 'session resolution failed');
    }

    next();
  };
}

export function readSessionCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function requireAuth() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.principal) return next(new ApiError('UNAUTHENTICATED', 'Sign in to continue.'));
    if (!req.principal.isActive) {
      return next(new ApiError('UNAUTHENTICATED', 'This account has been disabled.'));
    }
    next();
  };
}

/**
 * Enforce a permission.
 *
 * This is the authoritative check. The CMS also hides controls the user cannot
 * use, but that is a courtesy — hiding a button is not security, and every
 * mutating route passes through here.
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.principal) return next(new ApiError('UNAUTHENTICATED', 'Sign in to continue.'));

    const allowed = permissions.some((permission) => req.ability.can(permission));
    if (!allowed) {
      req.ctx.logger.warn(
        {
          requestId: req.requestId,
          actorId: req.principal.id,
          required: permissions,
          path: req.path,
        },
        'permission denied',
      );
      return next(new ApiError('FORBIDDEN', 'You do not have permission to do that.'));
    }

    next();
  };
}

/** Guard internal server-to-server routes (cache revalidation, preview). */
export function requireInternalKey() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const provided = req.header('x-internal-key');
    if (!provided || provided !== req.ctx.env.INTERNAL_API_KEY) {
      return next(new ApiError('FORBIDDEN', 'Invalid internal key.'));
    }
    next();
  };
}

/**
 * Read a required route parameter.
 *
 * Express types params as possibly undefined. Rather than casting, a missing
 * parameter is treated as a routing mistake and surfaces as a clean 404 instead
 * of an opaque database error further down.
 */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError('NOT_FOUND', 'That address is not valid.');
  }
  return value;
}

/** Client IP, honouring a single trusted proxy hop. */
export function clientIp(req: Request): string {
  const forwarded = req.header('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Rate limiting.
 *
 * Authenticated requests are keyed by user id so one busy editor behind a shared
 * office IP cannot exhaust the limit for their colleagues.
 */
export function rateLimit(name: RateLimitName) {
  const rule = RATE_LIMITS[name];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identity = req.principal?.id ?? clientIp(req);
    const key = `${name}:${identity}`;

    try {
      const result = await req.ctx.rateLimiter.check(key, rule);

      res.setHeader('x-ratelimit-limit', String(result.limit));
      res.setHeader('x-ratelimit-remaining', String(result.remaining));
      res.setHeader('x-ratelimit-reset', String(Math.ceil(result.resetAt / 1000)));

      if (!result.allowed) {
        res.setHeader('retry-after', String(result.retryAfterSeconds));
        req.ctx.logger.warn(
          { requestId: req.requestId, key: name, identity },
          'rate limit exceeded',
        );
        return next(
          new ApiError('RATE_LIMITED', 'Too many requests. Please wait a moment and try again.'),
        );
      }
    } catch (error) {
      // A rate-limiter outage must not take the API down with it.
      req.ctx.logger.error({ err: error }, 'rate limiter unavailable; allowing request');
    }

    next();
  };
}

/** Wrap an async handler so rejected promises reach the error middleware. */
export function asyncHandler<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req as T, res, next)).catch(next);
  };
}

export function notFoundHandler() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    next(new ApiError('NOT_FOUND', `No route matches ${req.method} ${req.path}.`));
  };
}

/**
 * Terminal error handler.
 *
 * Converts every known error type into the shared error body. An unexpected
 * error is logged in full and reported to the client as a generic message with
 * the request id — a stack trace never reaches a browser.
 */
export function errorHandler() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const apiError = toApiError(error);

    if (apiError.status >= 500) {
      req.ctx?.logger.error(
        { err: error, requestId: req.requestId, path: req.path, method: req.method },
        'unhandled error',
      );
    }

    res.status(apiError.status).json(apiError.toBody(req.requestId));
  };
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) return fromZodError(error);
  if (error instanceof AuthenticationError) return new ApiError('UNAUTHENTICATED', error.message);
  if (error instanceof AuthorizationError) {
    return new ApiError('FORBIDDEN', 'You do not have permission to do that.');
  }
  if (error instanceof InvalidTransitionError) {
    return new ApiError('INVALID_TRANSITION', error.message);
  }

  // Multer surfaces upload limits as errors with a code rather than a status.
  const code = (error as { code?: string }).code;
  if (code === 'LIMIT_FILE_SIZE') {
    return new ApiError('PAYLOAD_TOO_LARGE', 'That file is too large.');
  }
  if (code === 'LIMIT_UNEXPECTED_FILE') {
    return new ApiError('VALIDATION_ERROR', 'Unexpected file field.');
  }

  return new ApiError('INTERNAL_ERROR', 'Something went wrong. Please try again.');
}
