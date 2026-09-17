import type { PrismaClient, User } from '@cheezious/database';
import { type Permission, type Principal } from '@cheezious/permissions';

import { generateToken, hashToken } from './tokens';

/**
 * Session lifecycle.
 *
 * Sessions are database-backed rather than stateless JWTs. An administrator
 * disabling an account, or revoking a session, must take effect immediately —
 * a self-contained token that stays valid until expiry cannot offer that.
 */

export interface SessionConfig {
  ttlHours: number;
  idleTimeoutMinutes: number;
}

export interface CreatedSession {
  token: string;
  sessionId: string;
  expiresAt: Date;
}

export async function createSession(
  prisma: PrismaClient,
  userId: string,
  config: SessionConfig,
  context: { ipAddress?: string; userAgent?: string } = {},
): Promise<CreatedSession> {
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + config.ttlHours * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent?.slice(0, 500) ?? null,
    },
    select: { id: true },
  });

  return { token, sessionId: session.id, expiresAt };
}

export interface ResolvedSession {
  sessionId: string;
  principal: Principal;
}

/**
 * Resolve a raw session token to a principal, applying expiry, idle timeout,
 * revocation and account status in one pass. Returns null for any failure so a
 * caller cannot accidentally distinguish "expired" from "revoked".
 */
export async function resolveSession(
  prisma: PrismaClient,
  token: string,
  config: SessionConfig,
): Promise<ResolvedSession | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          roles: {
            include: { role: { include: { permissions: { include: { permission: true } } } } },
          },
        },
      },
    },
  });

  if (!session) return null;

  const now = Date.now();
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= now) return null;

  const idleLimitMs = config.idleTimeoutMinutes * 60 * 1000;
  if (now - session.lastActiveAt.getTime() > idleLimitMs) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: 'IDLE_TIMEOUT' },
    });
    return null;
  }

  const user = session.user;
  if (user.deletedAt || user.status !== 'ACTIVE') return null;

  // Sliding expiry: touch lastActiveAt, but at most once a minute to avoid a
  // database write on every single request.
  if (now - session.lastActiveAt.getTime() > 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastActiveAt: new Date() } });
  }

  return { sessionId: session.id, principal: toPrincipal(user) };
}

type UserWithRoles = User & {
  roles: Array<{ role: { key: string; permissions: Array<{ permission: { key: string } }> } }>;
};

export function toPrincipal(user: UserWithRoles): Principal {
  const permissions = new Set<string>();
  const roles: string[] = [];

  for (const { role } of user.roles) {
    roles.push(role.key);
    for (const { permission } of role.permissions) permissions.add(permission.key);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.status === 'ACTIVE' && !user.deletedAt,
    roles,
    permissions: [...permissions] as Permission[],
  };
}

export async function revokeSession(
  prisma: PrismaClient,
  sessionId: string,
  reason = 'LOGOUT',
): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

/** Revoke every session for a user — used on password change and on disable. */
export async function revokeAllSessionsForUser(
  prisma: PrismaClient,
  userId: string,
  reason: string,
  exceptSessionId?: string,
): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return result.count;
}

/** Housekeeping: drop sessions that expired more than a week ago. */
export async function pruneExpiredSessions(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  return result.count;
}
