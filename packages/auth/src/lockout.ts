import type { PrismaClient } from '@cheezious/database';

/**
 * Failed-login protection.
 *
 * Two independent controls, because they defend against different attacks:
 *   • Per-account lockout stops password guessing against one known user.
 *   • Per-IP throttling stops credential stuffing across many accounts, which a
 *     per-account counter alone would never notice.
 *
 * Login responses are deliberately uniform: a locked account and a wrong
 * password produce the same message, so the endpoint cannot be used to
 * enumerate valid email addresses.
 */

export interface LockoutConfig {
  maxFailedLogins: number;
  lockoutMinutes: number;
  /** Failed attempts allowed from one IP within the window, across all accounts. */
  maxAttemptsPerIp?: number;
  ipWindowMinutes?: number;
}

export interface LockoutState {
  locked: boolean;
  /** When the lock lifts. Never surfaced to the client. */
  until?: Date;
  remainingAttempts: number;
}

export async function checkAccountLockout(
  prisma: PrismaClient,
  email: string,
  config: LockoutConfig,
): Promise<LockoutState> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { failedLoginCount: true, lockedUntil: true },
  });

  if (!user) return { locked: false, remainingAttempts: config.maxFailedLogins };

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { locked: true, until: user.lockedUntil, remainingAttempts: 0 };
  }

  return {
    locked: false,
    remainingAttempts: Math.max(0, config.maxFailedLogins - user.failedLoginCount),
  };
}

/** True when this IP has produced too many failures recently. */
export async function isIpThrottled(
  prisma: PrismaClient,
  ipAddress: string | undefined,
  config: LockoutConfig,
): Promise<boolean> {
  if (!ipAddress) return false;
  const max = config.maxAttemptsPerIp ?? 20;
  const windowMinutes = config.ipWindowMinutes ?? 15;
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const failures = await prisma.loginAttempt.count({
    where: { ipAddress, successful: false, createdAt: { gte: since } },
  });
  return failures >= max;
}

export async function recordFailedLogin(
  prisma: PrismaClient,
  params: { email: string; userId?: string; ipAddress?: string; userAgent?: string; reason: string },
  config: LockoutConfig,
): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      email: params.email.toLowerCase(),
      userId: params.userId ?? null,
      successful: false,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent?.slice(0, 500) ?? null,
      reason: params.reason,
    },
  });

  if (!params.userId) return;

  const user = await prisma.user.update({
    where: { id: params.userId },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  });

  if (user.failedLoginCount >= config.maxFailedLogins) {
    await prisma.user.update({
      where: { id: params.userId },
      data: { lockedUntil: new Date(Date.now() + config.lockoutMinutes * 60 * 1000) },
    });
  }
}

export async function recordSuccessfulLogin(
  prisma: PrismaClient,
  params: { email: string; userId: string; ipAddress?: string; userAgent?: string },
): Promise<void> {
  await prisma.$transaction([
    prisma.loginAttempt.create({
      data: {
        email: params.email.toLowerCase(),
        userId: params.userId,
        successful: true,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent?.slice(0, 500) ?? null,
      },
    }),
    prisma.user.update({
      where: { id: params.userId },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: params.ipAddress ?? null,
      },
    }),
  ]);
}

/** Housekeeping: login attempts older than 30 days carry no further value. */
export async function pruneLoginAttempts(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
