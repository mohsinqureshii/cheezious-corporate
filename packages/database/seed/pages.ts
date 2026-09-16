import { validateBlock } from '@cheezious/page-builder';
import type { PrismaClient } from '@prisma/client';

import { heroForPath, placeholderForPath } from './media';
import { SITE_MAP, type PageSeedSpec } from './lib/site-map';

/**
 * Create the corporate page tree.
 *
 * Pages are created in two passes because blocks reference other pages by id:
 *   1. Create every page, so ids exist.
 *   2. Resolve `REF:` placeholders to real ids and write the blocks.
 *
 * That keeps internal links referencing page ids rather than URLs, which is what
 * makes a later rename harmless.
 */
export async function seedPages(
  prisma: PrismaClient,
  actorId: string,
  mediaByKey: Map<string, string>,
): Promise<void> {
  const definitions = new Map(
    (await prisma.blockDefinition.findMany({ select: { id: true, key: true } })).map((d) => [d.key, d.id]),
  );

  // --- Pass 1: pages --------------------------------------------------------
  const pageIdByPath = new Map<string, string>();

  for (const [index, spec] of SITE_MAP.entries()) {
    const slug = spec.path.split('/').filter(Boolean).pop() ?? 'company';

    const page = await prisma.page.upsert({
      where: { locale_path: { locale: 'en', path: spec.path } },
      create: {
        translationGroupId: `page${spec.path.replace(/\//g, '-')}`,
        locale: 'en',
        path: spec.path,
        slug,
        title: spec.title,
        navLabel: spec.navLabel ?? null,
        summary: spec.summary,
        type: (spec.type ?? 'STANDARD') as never,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        firstPublishedAt: new Date(),
        sortOrder: index,
        excludeFromSitemap: spec.excludeFromSitemap ?? false,
        createdById: actorId,
        publishedById: actorId,
      },
      update: { title: spec.title, summary: spec.summary, sortOrder: index },
      select: { id: true },
    });

    pageIdByPath.set(spec.path, page.id);

    await prisma.pageSeo.upsert({
      where: { pageId: page.id },
      create: {
        pageId: page.id,
        title: spec.title,
        description: spec.summary,
        noindex: spec.noindex ?? false,
        priority: spec.priority ?? defaultPriority(spec),
        changeFrequency: spec.changeFrequency ?? defaultChangeFrequency(spec),
      },
      update: {},
    });
  }

  // Parent relationships, derived from the path hierarchy so breadcrumbs work.
  for (const spec of SITE_MAP) {
    const parentPath = spec.path.split('/').slice(0, -1).join('/');
    const parentId = pageIdByPath.get(parentPath);
    const pageId = pageIdByPath.get(spec.path);
    if (!parentId || !pageId || parentPath === spec.path) continue;

    await prisma.page.update({ where: { id: pageId }, data: { parentId } });
  }

  // --- Pass 2: blocks -------------------------------------------------------
  const careerCategories = new Map(
    (await prisma.careerCategory.findMany({ select: { id: true, key: true } })).map((c) => [c.key, c.id]),
  );

  for (const spec of SITE_MAP) {
    const pageId = pageIdByPath.get(spec.path);
    if (!pageId) continue;

    // Re-seeding must not duplicate blocks, and must not clobber edits an
    // author has made: blocks are written only when a page has none.
    const existingBlocks = await prisma.pageBlock.count({ where: { pageId } });
    if (existingBlocks > 0) continue;

    for (const [index, block] of spec.blocks.entries()) {
      const definitionId = definitions.get(block.key);
      if (!definitionId) {
        console.warn(`    ! unknown block "${block.key}" on ${spec.path}; skipped`);
        continue;
      }

      // Each page draws a placeholder suited to its subject, so the seeded site
      // reads as a composed corporate site rather than one image repeated.
      const heroAssetId = mediaByKey.get(heroForPath(spec.path));
      const bodyAssetId = mediaByKey.get(placeholderForPath(spec.path));
      const assetId = block.key.startsWith('Hero') ? heroAssetId : bodyAssetId;

      const resolved = resolveReferences(block.data, pageIdByPath, careerCategories, assetId);
      const validation = validateBlock(block.key, resolved);

      if (!validation.ok) {
        console.warn(
          `    ! invalid block "${block.key}" on ${spec.path}: ` +
            validation.errors.map((e) => `${e.field} ${e.message}`).join('; '),
        );
        continue;
      }

      await prisma.pageBlock.create({
        data: {
          pageId,
          definitionId,
          blockKey: block.key,
          data: validation.data as never,
          sortOrder: index,
        },
      });
    }
  }
}

/**
 * Resolve `REF:` placeholders.
 *
 *   REF:/some/path        → the id of the page at that path
 *   REF:CAREER:KEY        → the id of that career category
 *
 * A reference that cannot be resolved is removed rather than left as a literal
 * string, so a page never ships a link pointing at "REF:/company".
 */
function resolveReferences(
  value: unknown,
  pages: Map<string, string>,
  careerCategories: Map<string, string>,
  assetId?: string,
): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('REF:CAREER:')) {
      return careerCategories.get(value.slice('REF:CAREER:'.length));
    }
    if (value.startsWith('REF:')) {
      return pages.get(value.slice(4));
    }
    // Media placeholders resolve to a generated placeholder asset. If none was
    // generated, the reference is dropped rather than left pointing at nothing.
    if (value === 'PLACEHOLDER') return assetId;
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => resolveReferences(item, pages, careerCategories, assetId))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const resolvedValue = resolveReferences(nested, pages, careerCategories, assetId);

      // A media reference whose asset id did not resolve is dropped entirely.
      if (key === 'image' || key === 'poster' || key === 'thumbnail' || key === 'media') {
        const asRecord = resolvedValue as { assetId?: unknown } | undefined;
        if (!asRecord || asRecord.assetId === undefined) continue;
      }
      if (resolvedValue === undefined) continue;

      out[key] = resolvedValue;
    }
    return out;
  }

  return value;
}

function defaultPriority(spec: PageSeedSpec): number {
  switch (spec.type) {
    case 'LANDING':
      return 0.9;
    case 'SECTION_INDEX':
      return 0.8;
    case 'DOCUMENT_CENTRE':
      return 0.6;
    case 'CONTACT':
      return 0.6;
    case 'SYSTEM':
      return 0.1;
    default:
      return 0.6;
  }
}

function defaultChangeFrequency(spec: PageSeedSpec): string {
  switch (spec.type) {
    case 'LANDING':
      return 'weekly';
    case 'SECTION_INDEX':
      return 'weekly';
    case 'DOCUMENT_CENTRE':
      return 'monthly';
    default:
      return 'monthly';
  }
}
