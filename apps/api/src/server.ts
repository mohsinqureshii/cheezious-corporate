import { disconnect } from '@cheezious/database';

import { createApp } from './app';
import { createContext } from './lib/context';

/**
 * API entry point.
 *
 * Boots by validating the environment, which fails fast with a readable report
 * rather than surfacing as an undefined value in a request handler later.
 */
async function main(): Promise<void> {
  const ctx = createContext();
  const app = createApp(ctx);

  const server = app.listen(ctx.env.API_PORT, ctx.env.API_HOST, () => {
    ctx.logger.info(
      { port: ctx.env.API_PORT, host: ctx.env.API_HOST, env: ctx.env.NODE_ENV },
      'Cheezious API listening',
    );
  });

  /**
   * Graceful shutdown: stop accepting connections, let in-flight requests
   * finish, then close the database pool. A publish that is halfway through a
   * transaction should not be cut off by a deploy.
   */
  const shutdown = (signal: string): void => {
    ctx.logger.info({ signal }, 'shutting down');

    const forceExit = setTimeout(() => {
      ctx.logger.error('shutdown timed out; exiting');
      process.exit(1);
    }, 15_000);
    forceExit.unref();

    server.close(async () => {
      await disconnect(ctx.prisma).catch(() => undefined);
      clearTimeout(forceExit);
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    ctx.logger.error({ err: reason }, 'unhandled promise rejection');
  });
  process.on('uncaughtException', (error) => {
    ctx.logger.fatal({ err: error }, 'uncaught exception; exiting');
    process.exit(1);
  });
}

main().catch((error: unknown) => {
  // The logger may not exist yet if environment validation failed.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
