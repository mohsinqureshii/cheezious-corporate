import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Resolve a relative storage root against the repository root.
 *
 * Mirrors the API's resolution so the seed writes files exactly where the API
 * will later look for them. Duplicated rather than imported because the seed
 * must not depend on the API package.
 */
export function resolveStorageRoot(configured: string): string {
  if (path.isAbsolute(configured)) return configured;

  let directory = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(path.join(directory, 'pnpm-workspace.yaml'))) {
      return path.resolve(directory, configured);
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  return path.resolve(process.cwd(), configured);
}
