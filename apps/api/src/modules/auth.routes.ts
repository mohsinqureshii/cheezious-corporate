import {
  checkAccountLockout,
  checkPasswordPolicy,
  createSession,
  generateToken,
  hashPassword,
  hashToken,
  isIpThrottled,
  needsRehash,
  recordFailedLogin,
  recordSuccessfulLogin,
  revokeAllSessionsForUser,
  revokeSession,
  toPrincipal,
  verifyPassword,
} from '@cheezious/auth';
import { ApiError, email as emailSchema } from '@cheezious/validation';
import { Router } from 'express';
import { z } from 'zod';

import { AuditService } from '../lib/audit';
import { asyncHandler, clientIp, rateLimit, requireAuth, SESSION_COOKIE } from '../middleware';

/**
 * CMS authentication.
 *
 * The overriding design rule is that no endpoint here may reveal whether an
 * email address belongs to an account. Wrong password, unknown user, locked
 * account and disabled account all produce the same response and take
 * comparable time, so the login form cannot be used to enumerate staff.
 */

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(200),
});

const GENERIC_LOGIN_FAILURE = 'That email address and password do not match.';

export function authRoutes(): Router {
  const router = Router();

  router.post(
    '/login',
    rateLimit('login'),
    asyncHandler(async (req, res) => {
      const { email, password } = loginSchema.parse(req.body);
      const ip = clientIp(req);
      const userAgent = req.header('user-agent');
      const { prisma, env, logger } = req.ctx;

      const lockoutConfig = {
        maxFailedLogins: env.MAX_FAILED_LOGINS,
        lockoutMinutes: env.LOGIN_LOCKOUT_MINUTES,
      };

      // Per-IP throttling catches credential stuffing across many accounts,
      // which a per-account counter would never see.
      if (await isIpThrottled(prisma, ip, lockoutConfig)) {
        logger.warn({ ip }, 'login blocked by IP throttle');
        throw new ApiError('RATE_LIMITED', 'Too many sign-in attempts. Please try again later.');
      }

      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
        include: {
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        },
      });

      const lockout = await checkAccountLockout(prisma, email, lockoutConfig);

      // Always run a password verification, even with no user, so that a missing
      // account and a wrong password take the same time.
      const passwordMatches = await verifyPassword(user?.passwordHash ?? null, password);

      const failureReason = !user
        ? 'UNKNOWN_USER'
        : lockout.locked
          ? 'LOCKED'
          : user.status !== 'ACTIVE'
            ? 'INACTIVE'
            : !passwordMatches
              ? 'BAD_PASSWORD'
              : null;

      if (failureReason || !user) {
        await recordFailedLogin(
          prisma,
          { email, userId: user?.id, ipAddress: ip, userAgent, reason: failureReason ?? 'UNKNOWN_USER' },
          lockoutConfig,
        );
        await new AuditService(prisma).record(
          { email, ipAddress: ip, userAgent },
          {
            action: 'LOGIN_FAILED',
            entityType: 'user',
            entityId: user?.id ?? null,
            summary: `Sign-in failed (${failureReason ?? 'UNKNOWN_USER'})`,
          },
        );
        throw new ApiError('UNAUTHENTICATED', GENERIC_LOGIN_FAILURE);
      }

      // Opportunistically upgrade a hash produced under weaker parameters.
      if (user.passwordHash && needsRehash(user.passwordHash)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: await hashPassword(password) },
        });
      }

      await recordSuccessfulLogin(prisma, { email, userId: user.id, ipAddress: ip, userAgent });

      const session = await createSession(
        prisma,
        user.id,
        { ttlHours: env.SESSION_TTL_HOURS, idleTimeoutMinutes: env.SESSION_IDLE_TIMEOUT_MINUTES },
        { ipAddress: ip, userAgent },
      );

      await new AuditService(prisma).record(
        { id: user.id, email: user.email, ipAddress: ip, userAgent },
        { action: 'LOGIN', entityType: 'user', entityId: user.id, summary: 'Signed in' },
      );

      setSessionCookie(res, session.token, session.expiresAt, env.NODE_ENV === 'production');

      res.json({
        user: toPrincipal(user),
        expiresAt: session.expiresAt,
        mustChangePassword: user.mustChangePassword,
      });
    }),
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      if (req.sessionId) {
        await revokeSession(req.ctx.prisma, req.sessionId, 'LOGOUT');
        await new AuditService(req.ctx.prisma).record(
          { id: req.principal?.id, email: req.principal?.email, ipAddress: clientIp(req) },
          { action: 'LOGOUT', entityType: 'user', entityId: req.principal?.id ?? null, summary: 'Signed out' },
        );
      }
      clearSessionCookie(res, req.ctx.env.NODE_ENV === 'production');
      res.json({ ok: true });
    }),
  );

  /** The current principal, used by the CMS to render its shell. */
  router.get(
    '/me',
    requireAuth(),
    asyncHandler(async (req, res) => {
      const user = await req.ctx.prisma.user.findUnique({
        where: { id: req.principal!.id },
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          lastLoginAt: true,
          mustChangePassword: true,
          avatar: { select: { id: true, storageKey: true } },
        },
      });

      res.json({
        user: { ...req.principal, ...user },
        unreadNotifications: await req.ctx.prisma.notification.count({
          where: { userId: req.principal!.id, readAt: null },
        }),
      });
    }),
  );

  /**
   * Request a password reset.
   *
   * Always responds with the same success message, whether or not the address
   * belongs to an account.
   */
  router.post(
    '/password/forgot',
    rateLimit('passwordResetRequest'),
    asyncHandler(async (req, res) => {
      const { email } = z.object({ email: emailSchema }).parse(req.body);
      const { prisma, env, logger } = req.ctx;

      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, email: true, name: true },
      });

      if (user) {
        // Invalidate any outstanding reset so only the newest link works.
        await prisma.passwordReset.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });

        const token = generateToken(32);
        await prisma.passwordReset.create({
          data: {
            tokenHash: hashToken(token),
            userId: user.id,
            expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
            ipAddress: clientIp(req),
          },
        });

        await new AuditService(prisma).record(
          { id: user.id, email: user.email, ipAddress: clientIp(req) },
          {
            action: 'PASSWORD_RESET_REQUESTED',
            entityType: 'user',
            entityId: user.id,
            summary: 'Password reset requested',
          },
        );

        const resetUrl = `${env.CMS_URL}/reset-password?token=${token}`;
        // A mail transport is wired in via the notifications adapter; until one
        // is configured the link is logged so development is not blocked.
        logger.info({ userId: user.id, resetUrl }, 'password reset link issued');
      }

      res.json({
        ok: true,
        message: 'If that email address has an account, a reset link is on its way.',
      });
    }),
  );

  router.post(
    '/password/reset',
    rateLimit('passwordResetConfirm'),
    asyncHandler(async (req, res) => {
      const { token, password } = z
        .object({ token: z.string().min(10).max(200), password: z.string().min(1).max(200) })
        .parse(req.body);
      const { prisma } = req.ctx;

      const reset = await prisma.passwordReset.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: { select: { id: true, email: true, name: true, status: true, deletedAt: true } } },
      });

      const invalid =
        !reset ||
        reset.usedAt !== null ||
        reset.expiresAt.getTime() <= Date.now() ||
        reset.user.deletedAt !== null ||
        reset.user.status !== 'ACTIVE';

      if (invalid) {
        throw new ApiError('VALIDATION_ERROR', 'That reset link is invalid or has expired. Request a new one.');
      }

      const policy = checkPasswordPolicy(password, { email: reset.user.email, name: reset.user.name });
      if (!policy.valid) {
        throw ApiError.validation(policy.errors.map((message) => ({ field: 'password', message })));
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: reset.user.id },
          data: {
            passwordHash: await hashPassword(password),
            passwordChangedAt: new Date(),
            mustChangePassword: false,
            failedLoginCount: 0,
            lockedUntil: null,
          },
        }),
        prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      ]);

      // Changing a password ends every existing session: if the reset was
      // triggered by a compromise, the attacker's session must not survive it.
      const revoked = await revokeAllSessionsForUser(prisma, reset.user.id, 'PASSWORD_CHANGED');

      await new AuditService(prisma).record(
        { id: reset.user.id, email: reset.user.email, ipAddress: clientIp(req) },
        {
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'user',
          entityId: reset.user.id,
          summary: `Password reset completed; ${revoked} session(s) revoked`,
        },
      );

      res.json({ ok: true, message: 'Your password has been changed. Sign in with your new password.' });
    }),
  );

  /** Change a password while signed in. Requires the current password. */
  router.post(
    '/password/change',
    requireAuth(),
    asyncHandler(async (req, res) => {
      const { currentPassword, newPassword } = z
        .object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) })
        .parse(req.body);
      const { prisma } = req.ctx;

      const user = await prisma.user.findUnique({
        where: { id: req.principal!.id },
        select: { id: true, email: true, name: true, passwordHash: true },
      });
      if (!user) throw ApiError.notFound('Account');

      if (!(await verifyPassword(user.passwordHash, currentPassword))) {
        throw ApiError.validation([{ field: 'currentPassword', message: 'That is not your current password.' }]);
      }

      const policy = checkPasswordPolicy(newPassword, { email: user.email, name: user.name });
      if (!policy.valid) {
        throw ApiError.validation(policy.errors.map((message) => ({ field: 'newPassword', message })));
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(newPassword),
          passwordChangedAt: new Date(),
          mustChangePassword: false,
        },
      });

      // Every other session is ended; the one making the change survives.
      const revoked = await revokeAllSessionsForUser(prisma, user.id, 'PASSWORD_CHANGED', req.sessionId ?? undefined);

      await new AuditService(prisma).record(
        { id: user.id, email: user.email, ipAddress: clientIp(req) },
        {
          action: 'UPDATE',
          entityType: 'user',
          entityId: user.id,
          summary: `Password changed; ${revoked} other session(s) revoked`,
        },
      );

      res.json({ ok: true, revokedSessions: revoked });
    }),
  );

  /** Active sessions, so a user can see and end their own logged-in devices. */
  router.get(
    '/sessions',
    requireAuth(),
    asyncHandler(async (req, res) => {
      const sessions = await req.ctx.prisma.session.findMany({
        where: { userId: req.principal!.id, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastActiveAt: 'desc' },
        select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastActiveAt: true, expiresAt: true },
      });

      res.json({
        sessions: sessions.map((session) => ({ ...session, isCurrent: session.id === req.sessionId })),
      });
    }),
  );

  router.delete(
    '/sessions/:id',
    requireAuth(),
    asyncHandler(async (req, res) => {
      const session = await req.ctx.prisma.session.findFirst({
        where: { id: req.params.id, userId: req.principal!.id },
        select: { id: true },
      });
      if (!session) throw ApiError.notFound('Session');

      await revokeSession(req.ctx.prisma, session.id, 'REVOKED_BY_USER');
      res.json({ ok: true });
    }),
  );

  return router;
}

function setSessionCookie(
  res: import('express').Response,
  token: string,
  expiresAt: Date,
  secure: boolean,
): void {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    // Lax rather than Strict: the CMS follows links in notification emails, and
    // Strict would drop the session on that first cross-site navigation.
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
    ...(secure ? ['Secure'] : []),
  ];
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(res: import('express').Response, secure: boolean): void {
  res.setHeader(
    'Set-Cookie',
    [
      `${SESSION_COOKIE}=`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      ...(secure ? ['Secure'] : []),
    ].join('; '),
  );
}
