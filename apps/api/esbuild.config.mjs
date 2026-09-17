import { build } from 'esbuild';

/**
 * Production build for the API and the worker.
 *
 * `tsc` alone cannot produce a runnable artifact here, for two reasons that
 * compound. The app is an ES module compiled with `moduleResolution: bundler`,
 * so its relative imports are emitted without file extensions and Node's ESM
 * loader refuses them. And the workspace packages deliberately ship TypeScript
 * source — `"exports": "./src/index.ts"` — which Node cannot load at all. In
 * development `tsx` transpiles both on the fly; nothing does that in a deploy.
 *
 * So the entry points are bundled: the `@cheezious/*` packages are inlined,
 * everything in node_modules stays external and is installed normally. Native
 * and generated dependencies — sharp, the Prisma client — must stay external,
 * and do.
 *
 * The output is CommonJS with a `.cjs` extension. This package is
 * `"type": "module"`, so the extension is what tells Node how to read it, and
 * CommonJS is the interop-safe choice for a dependency set that is entirely
 * CommonJS.
 */

/** Inline the workspace packages; leave real dependencies to node_modules. */
const bundleWorkspaceOnly = {
  name: 'bundle-workspace-only',
  setup(pluginBuild) {
    // Bare specifiers only: a leading `.` or `/` is a path, and paths are ours.
    pluginBuild.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith('@cheezious/')) return null;
      return { path: args.path, external: true };
    });
  },
};

const entries = [
  { in: 'src/server.ts', out: 'dist/server.cjs' },
  { in: 'src/worker.ts', out: 'dist/worker.cjs' },
];

await Promise.all(
  entries.map((entry) =>
    build({
      entryPoints: [entry.in],
      outfile: entry.out,
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'cjs',
      sourcemap: true,
      // Keep names so stack traces and the audit log's class names survive.
      keepNames: true,
      logLevel: 'info',
      plugins: [bundleWorkspaceOnly],
    }),
  ),
);
