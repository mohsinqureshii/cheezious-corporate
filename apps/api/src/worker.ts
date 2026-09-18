import { prisma } from '@cheezious/database';

import { startWorker, stopWorker } from './worker-runtime';

/**
 * The worker as its own process.
 *
 * A thin entry point: the loop itself lives in `worker-runtime.ts`, so the same
 * code can run here or inside the API. Running it separately is the better
 * arrangement once there is enough traffic to care — a long job cannot then
 * block a request, and the two scale independently. Running it inside the API
 * is one fewer thing to deploy. Both are supported; see `RUN_WORKER`.
 */

async function shutdown(): Promise<void> {
  await stopWorker();
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

process.on('unhandledRejection', (reason) => {
  console.error('unhandled rejection in worker', reason);
});

startWorker().catch(async (error: unknown) => {
  console.error('worker failed to start', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
