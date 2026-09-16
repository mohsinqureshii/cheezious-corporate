import { BLOCK_SPECS } from '@cheezious/page-builder';
import type { PrismaClient } from '@prisma/client';
import { zodToJsonSchema } from './lib/json-schema';

/**
 * Register every block from the code registry in the database.
 *
 * The schema is mirrored as JSON Schema so the CMS can drive a generic editor
 * form without importing Zod into the browser bundle. An administrator can
 * disable a block through the CMS; re-seeding preserves that choice.
 */
export async function seedBlocks(prisma: PrismaClient): Promise<void> {
  for (const spec of BLOCK_SPECS) {
    await prisma.blockDefinition.upsert({
      where: { key: spec.key },
      create: {
        key: spec.key,
        name: spec.name,
        description: spec.description,
        category: spec.category,
        icon: spec.icon,
        schema: zodToJsonSchema(spec.schema, spec.key),
        defaults: {},
        allowedPageTypes: (spec.allowedPageTypes ?? []) as never,
        sortOrder: spec.sortOrder,
      },
      update: {
        name: spec.name,
        description: spec.description,
        category: spec.category,
        icon: spec.icon,
        schema: zodToJsonSchema(spec.schema, spec.key),
        sortOrder: spec.sortOrder,
        // `isEnabled` is intentionally not updated: it belongs to the administrator.
      },
    });
  }
}
