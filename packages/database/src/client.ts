import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Prisma client singleton.
 *
 * Next.js dev-mode hot reloading re-evaluates modules on every change, which
 * would otherwise open a new connection pool per reload until PostgreSQL refuses
 * connections. The instance is therefore cached on `globalThis` outside
 * production.
 */

const globalForPrisma = globalThis as unknown as { __cheeziousPrisma?: PrismaClient };

export interface CreatePrismaOptions {
  datasourceUrl?: string;
  log?: Prisma.LogLevel[];
}

export function createPrismaClient(options: CreatePrismaOptions = {}): PrismaClient {
  const log: Prisma.LogLevel[] =
    options.log ?? (process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']);

  return new PrismaClient({
    log,
    ...(options.datasourceUrl ? { datasourceUrl: options.datasourceUrl } : {}),
  });
}

export const prisma: PrismaClient = globalForPrisma.__cheeziousPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__cheeziousPrisma = prisma;
}

/** Liveness probe: confirms the process can reach PostgreSQL. */
export async function checkDatabaseConnection(client: PrismaClient = prisma): Promise<boolean> {
  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function disconnect(client: PrismaClient = prisma): Promise<void> {
  await client.$disconnect();
}

/** Narrow a caught error to a Prisma unique-constraint violation on `target`. */
export function isUniqueConstraintError(error: unknown, target?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  if (!target) return true;
  const meta = error.meta as { target?: string[] | string } | undefined;
  const fields = Array.isArray(meta?.target) ? meta.target : meta?.target ? [meta.target] : [];
  return fields.some((f) => f.includes(target));
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
