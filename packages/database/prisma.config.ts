import path from 'node:path';

import { defineConfig } from 'prisma/config';

/**
 * Prisma configuration. Replaces the deprecated `package.json#prisma` block.
 * Environment variables are loaded by the caller (`dotenv -e ../../.env`) so the
 * whole monorepo reads one .env file at the repository root.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx seed/index.ts',
  },
});
