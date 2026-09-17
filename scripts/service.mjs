#!/usr/bin/env node
import { spawn } from 'node:child_process';

/**
 * Build or start one service out of the workspace.
 *
 * Four processes run from this repository — the API, the worker, the public
 * site and the CMS — so the root `package.json` cannot have a single meaningful
 * `start` script. Platforms that infer what to run from the root package (which
 * is most of them, Railway's Railpack included) therefore refuse to build at
 * all: "no start command detected".
 *
 * This is that command. It reads `SERVICE` from the environment and dispatches,
 * so a platform needs one variable per service and no knowledge of the layout.
 * Setting an explicit build and start command per service works too and is more
 * direct; this exists so that nothing is required to work.
 *
 *   SERVICE=api    pnpm start
 *   SERVICE=worker pnpm start
 *   SERVICE=web    pnpm start
 *   SERVICE=cms    pnpm start
 */

const SERVICES = {
  api: { pkg: '@cheezious/api', start: 'start' },
  worker: { pkg: '@cheezious/api', start: 'worker:start' },
  web: { pkg: '@cheezious/corporate-web', start: 'start' },
  cms: { pkg: '@cheezious/cms', start: 'start' },
};

const names = Object.keys(SERVICES).join(', ');
const task = process.argv[2];
const service = process.env.SERVICE?.trim();

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, { stdio: 'inherit', shell: false });
    // Signals have to reach the real process, or a deploy's SIGTERM stops at
    // this wrapper and the service is killed mid-request instead of draining.
    for (const signal of ['SIGTERM', 'SIGINT']) {
      process.on(signal, () => child.kill(signal));
    }
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) process.kill(process.pid, signal);
      else if (code === 0) resolve();
      else reject(new Error(`pnpm ${args.join(' ')} exited with ${code}`));
    });
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (service && !SERVICES[service]) {
  fail(`Unknown SERVICE "${service}". Expected one of: ${names}.`);
}

if (task === 'build') {
  // The workspace packages come first: one of them generates the Prisma client,
  // which everything else compiles against.
  await run(['build:packages']);
  // No SERVICE means a developer running `pnpm build` locally, who wants all of
  // it. A platform sets SERVICE and builds only what that service runs.
  await run(
    service
      ? ['--filter', SERVICES[service].pkg, 'build']
      : ['-r', '--filter', './apps/**', 'build'],
  );
} else if (task === 'start') {
  if (!service) {
    fail(
      `SERVICE is not set, and there is no single thing to start.\n` +
        `Set it to one of: ${names}.`,
    );
  }
  await run(['--filter', SERVICES[service].pkg, SERVICES[service].start]);
} else {
  fail(`Usage: node scripts/service.mjs <build|start>`);
}
