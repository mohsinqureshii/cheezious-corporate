import { MemoryRateLimitStore, RateLimiter } from '@cheezious/auth';
import { apiSchema, assertProductionSecrets, parseEnv, type ApiEnv } from '@cheezious/config';
import { prisma } from '@cheezious/database';
import type { PrismaClient } from '@cheezious/database';
import { createLogger, type Logger } from '@cheezious/logger';

/**
 * Application context.
 *
 * Every module receives its dependencies through this object rather than
 * importing singletons directly. That is what makes the integration tests able
 * to run the real HTTP stack against a throwaway database.
 */

export interface AppContext {
  env: ApiEnv;
  prisma: PrismaClient;
  logger: Logger;
  rateLimiter: RateLimiter;
}

let cached: AppContext | undefined;

export function createContext(overrides: Partial<AppContext> = {}): AppContext {
  const env = overrides.env ?? parseEnv(apiSchema);
  assertProductionSecrets(env);

  const logger =
    overrides.logger ??
    createLogger({
      name: 'cheezious-api',
      level: env.LOG_LEVEL,
      pretty: env.NODE_ENV === 'development',
    });

  return {
    env,
    prisma: overrides.prisma ?? prisma,
    logger,
    rateLimiter: overrides.rateLimiter ?? new RateLimiter(new MemoryRateLimitStore()),
  };
}

export function getContext(): AppContext {
  cached ??= createContext();
  return cached;
}

export function setContext(context: AppContext): void {
  cached = context;
}
