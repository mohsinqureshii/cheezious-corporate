import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

import type { Express } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

import type { AppContext } from './lib/context';

/**
 * Serve the whole platform from one process.
 *
 * The API stays exactly as it is and gains a second job: it starts the public
 * site and the CMS as child processes bound to loopback, and forwards anything
 * that is not an API route to whichever of them owns it.
 *
 * The point is the single origin. A browser that only ever talks to one host
 * needs no CORS, no preflight, and no absolute API URL compiled into a bundle —
 * which between them accounted for most of the configuration this platform is
 * otherwise fiddly to deploy. The CMS runs under `/admin` for the same reason.
 *
 * What it gives up: the site and the CMS can no longer be deployed or scaled
 * separately, and one process now holds three applications, so a crash takes
 * all of them. That is the trade, and it is the right one until the traffic
 * says otherwise. Setting `SERVE_ALL=false` puts everything back.
 */

interface Child {
  name: string;
  process: ChildProcess;
}

const children: Child[] = [];

/** The repository root, found from this file rather than from the cwd. */
function repositoryRoot(): string {
  // dist/ sits at apps/api/dist, so the root is three levels up.
  return path.resolve(__dirname, '..', '..', '..');
}

function startChild(name: string, filter: string, port: number, env: NodeJS.ProcessEnv): Child {
  const child = spawn(
    'pnpm',
    ['--filter', filter, 'exec', 'next', 'start', '-H', '127.0.0.1', '-p', String(port)],
    { cwd: repositoryRoot(), stdio: 'inherit', env: { ...process.env, ...env } },
  );
  const entry: Child = { name, process: child };
  children.push(entry);
  return entry;
}

/**
 * Start the child applications and mount the proxies.
 *
 * Called after the API's own routes are registered and before its 404 handler,
 * so an unknown `/api` path still answers as the API rather than being handed
 * to Next.
 */
export function mountGateway(app: Express, ctx: AppContext): void {
  const { logger, env } = ctx;
  const webPort = env.WEB_INTERNAL_PORT;
  const cmsPort = env.CMS_INTERNAL_PORT;

  logger.info({ webPort, cmsPort }, 'serving the site and the CMS from this process');

  startChild('web', '@cheezious/corporate-web', webPort, {
    PORT: String(webPort),
    // Relative in the browser, loopback on the server: same origin either way,
    // and the server never makes a round trip through the public edge.
    NEXT_PUBLIC_API_URL: '',
    INTERNAL_API_URL: `http://127.0.0.1:${env.API_PORT}`,
  });

  startChild('cms', '@cheezious/cms', cmsPort, {
    PORT: String(cmsPort),
    CMS_BASE_PATH: '/admin',
    NEXT_PUBLIC_CMS_API_URL: '',
    INTERNAL_API_URL: `http://127.0.0.1:${env.API_PORT}`,
  });

  for (const { name, process: child } of children) {
    child.on('exit', (code, signal) => {
      // One application down means the deployment is not serving what it
      // promises. Exiting lets the platform restart the whole thing, which is
      // the only recovery available when the three share a process tree.
      logger.error({ app: name, code, signal }, 'child application exited; stopping');
      process.exit(1);
    });
  }

  // `/admin` is the CMS; everything else that is not an API route is the site.
  app.use(
    '/admin',
    createProxyMiddleware({
      target: `http://127.0.0.1:${cmsPort}`,
      changeOrigin: false,
      // The CMS is built with basePath '/admin', so it expects to see the
      // prefix. Express strips it before the handler runs; this puts it back.
      pathRewrite: (requestPath) => `/admin${requestPath}`,
      ws: true,
    }),
  );

  app.use(
    createProxyMiddleware({
      target: `http://127.0.0.1:${webPort}`,
      changeOrigin: false,
      ws: true,
    }),
  );
}

/** Stop the child applications, for an orderly shutdown. */
export function stopGateway(): void {
  for (const { process: child } of children) child.kill('SIGTERM');
}
