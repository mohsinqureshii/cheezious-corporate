import type { Locale, Prisma, PrismaClient } from '@cheezious/database';
import {
  collectMediaReferences,
  validateComposition,
  type PageBlockInput,
} from '@cheezious/page-builder';
import { normalizePath } from '@cheezious/utilities';
import { ApiError } from '@cheezious/validation';

import { hasUnpublishedChanges, type VersionSnapshot } from './versioning';

/**
 * Page service.
 *
 * Owns the two things that are easy to get wrong about a CMS page: keeping URLs
 * stable when editors rename things, and keeping the published snapshot separate
 * from the working copy.
 */

export const PAGE_INCLUDE = {
  blocks: { orderBy: { sortOrder: 'asc' } },
  seo: { include: { ogImage: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  updatedBy: { select: { id: true, name: true, email: true } },
  publishedBy: { select: { id: true, name: true, email: true } },
  contentOwner: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PageInclude;

export class PageService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Resolve a public request for a path.
   *
   * Tries the live path first, then slug history. A page that moved returns a
   * redirect instruction rather than a 404, so links shared before a rename keep
   * working — including links in press releases we no longer control.
   */
  async resolvePublicPath(
    locale: Locale,
    path: string,
  ): Promise<
    | { kind: 'page'; pageId: string }
    | { kind: 'redirect'; destination: string; statusCode: number }
    | { kind: 'notFound' }
  > {
    const normalised = normalizePath(path);

    const page = await this.prisma.page.findFirst({
      where: { locale, path: normalised, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (page) return { kind: 'page', pageId: page.id };

    // An explicit redirect takes precedence over slug history, because an
    // administrator created it deliberately.
    const redirect = await this.prisma.redirect.findFirst({
      where: {
        source: normalised,
        isEnabled: true,
        OR: [{ locale }, { locale: null }],
      },
      orderBy: { locale: 'desc' },
    });
    if (redirect) {
      await this.prisma.redirect
        .update({
          where: { id: redirect.id },
          data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
        })
        .catch(() => undefined); // Counter failures must not break the redirect.
      return {
        kind: 'redirect',
        destination: redirect.destination,
        statusCode: redirect.statusCode,
      };
    }

    const historical = await this.prisma.slugHistory.findFirst({
      where: { locale, oldPath: normalised, entityType: 'page' },
      orderBy: { createdAt: 'desc' },
    });
    if (historical) {
      // Follow the chain: a page renamed twice should land on its current path,
      // not on an intermediate path that also no longer exists.
      const destination = await this.followSlugChain(locale, historical.newPath);
      return { kind: 'redirect', destination, statusCode: 301 };
    }

    return { kind: 'notFound' };
  }

  private async followSlugChain(locale: Locale, path: string, depth = 0): Promise<string> {
    if (depth >= 5) return path;

    const exists = await this.prisma.page.findFirst({
      where: { locale, path, deletedAt: null },
      select: { id: true },
    });
    if (exists) return path;

    const next = await this.prisma.slugHistory.findFirst({
      where: { locale, oldPath: path, entityType: 'page' },
      orderBy: { createdAt: 'desc' },
    });
    return next ? this.followSlugChain(locale, next.newPath, depth + 1) : path;
  }

  /**
   * Record a path change and create the redirect that keeps the old URL working.
   *
   * Only published pages generate redirects: a draft that was never public has
   * no inbound links to preserve, and generating redirects for drafts would fill
   * the redirect table with noise.
   */
  async recordPathChange(
    params: {
      pageId: string;
      locale: Locale;
      oldPath: string;
      newPath: string;
      wasPublished: boolean;
      actorId?: string | null;
      createRedirect: boolean;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (params.oldPath === params.newPath) return;

    await tx.slugHistory.create({
      data: {
        pageId: params.pageId,
        entityType: 'page',
        entityId: params.pageId,
        locale: params.locale,
        oldPath: params.oldPath,
        newPath: params.newPath,
        createdById: params.actorId ?? null,
      },
    });

    if (!params.wasPublished || !params.createRedirect) return;

    // A redirect whose destination is the path we are leaving would loop.
    await tx.redirect.deleteMany({
      where: { source: params.newPath, locale: params.locale, isAutomatic: true },
    });

    await tx.redirect.upsert({
      where: { source_locale: { source: params.oldPath, locale: params.locale } },
      create: {
        source: params.oldPath,
        destination: params.newPath,
        statusCode: 301,
        locale: params.locale,
        isAutomatic: true,
        note: 'Created automatically when the page path changed.',
        createdById: params.actorId ?? null,
      },
      update: { destination: params.newPath, isEnabled: true },
    });

    // Re-point older redirects that used to lead here, so a chain of renames
    // never costs a visitor more than one hop.
    await tx.redirect.updateMany({
      where: { destination: params.oldPath, locale: params.locale, isAutomatic: true },
      data: { destination: params.newPath },
    });
  }

  /** Detect a cycle before saving a redirect. */
  async wouldCreateLoop(
    source: string,
    destination: string,
    locale: Locale | null,
  ): Promise<boolean> {
    if (source === destination) return true;

    let current = destination;
    for (let hops = 0; hops < 10; hops += 1) {
      const next = await this.prisma.redirect.findFirst({
        where: { source: current, isEnabled: true, OR: [{ locale }, { locale: null }] },
        select: { destination: true },
      });
      if (!next) return false;
      if (next.destination === source) return true;
      current = next.destination;
    }
    return true; // Ten hops without terminating is a loop for practical purposes.
  }

  /**
   * Replace a page's blocks.
   *
   * The whole composition is validated first: a page is never left half-written
   * because block 7 of 12 failed validation.
   */
  async replaceBlocks(
    pageId: string,
    blocks: PageBlockInput[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const result = validateComposition(blocks);
    if (!result.ok) {
      throw ApiError.validation(
        result.errors.map((error) => ({
          field: `blocks.${error.index}.${error.field}`,
          message: `${error.blockKey}: ${error.message}`,
        })),
      );
    }

    const definitions = await tx.blockDefinition.findMany({
      where: { key: { in: result.blocks.map((b) => b.blockKey) } },
      select: { id: true, key: true, isEnabled: true },
    });
    const byKey = new Map(definitions.map((d) => [d.key, d]));

    const missing = result.blocks.filter((b) => !byKey.has(b.blockKey));
    if (missing.length > 0) {
      throw ApiError.validation(
        missing.map((b) => ({
          field: 'blocks',
          message: `Block type "${b.blockKey}" is not registered.`,
        })),
      );
    }

    const disabled = result.blocks.filter((b) => byKey.get(b.blockKey)?.isEnabled === false);
    if (disabled.length > 0) {
      throw ApiError.validation(
        disabled.map((b) => ({
          field: 'blocks',
          message: `Block type "${b.blockKey}" is disabled.`,
        })),
      );
    }

    await tx.pageBlock.deleteMany({ where: { pageId } });

    if (result.blocks.length > 0) {
      await tx.pageBlock.createMany({
        data: result.blocks.map((block, index) => {
          const source = blocks[index];
          return {
            pageId,
            definitionId: byKey.get(block.blockKey)!.id,
            blockKey: block.blockKey,
            data: block.data as Prisma.InputJsonValue,
            sortOrder: index,
            isHidden: source?.isHidden ?? false,
            label: source?.label ?? null,
            anchor: source?.anchor ?? null,
          };
        }),
      });
    }

    await this.syncMediaUsage(pageId, result.blocks, tx);
  }

  /**
   * Maintain the reverse index of which media a page uses.
   *
   * This is what lets the media library warn "used in 7 places" before a delete,
   * instead of silently breaking pages.
   */
  private async syncMediaUsage(
    pageId: string,
    blocks: Array<{ blockKey: string; data: Record<string, unknown> }>,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const assetIds = new Set<string>();
    for (const block of blocks) collectMediaReferences(block.data, assetIds);

    await tx.mediaUsage.deleteMany({ where: { entityType: 'page', entityId: pageId } });
    if (assetIds.size === 0) return;

    // Only reference assets that actually exist; a stale id in block data must
    // not fail the save.
    const existing = await tx.mediaAsset.findMany({
      where: { id: { in: [...assetIds] }, deletedAt: null },
      select: { id: true },
    });

    const page = await tx.page.findUnique({
      where: { id: pageId },
      select: { title: true, path: true },
    });

    if (existing.length > 0) {
      await tx.mediaUsage.createMany({
        data: existing.map((asset) => ({
          assetId: asset.id,
          entityType: 'page',
          entityId: pageId,
          entityLabel: page?.title ?? null,
          field: 'blocks',
          href: page?.path ?? null,
        })),
        skipDuplicates: true,
      });
    }
  }

  /** Build the snapshot that becomes a version, and is served when published. */
  async buildSnapshot(pageId: string, tx?: Prisma.TransactionClient): Promise<VersionSnapshot> {
    const client = tx ?? this.prisma;
    const page = await client.page.findUnique({
      where: { id: pageId },
      include: {
        blocks: { orderBy: { sortOrder: 'asc' } },
        seo: true,
      },
    });
    if (!page) throw ApiError.notFound('Page');

    return {
      title: page.title,
      navLabel: page.navLabel,
      summary: page.summary,
      path: page.path,
      slug: page.slug,
      type: page.type,
      locale: page.locale,
      parentId: page.parentId,
      sortOrder: page.sortOrder,
      excludeFromSearch: page.excludeFromSearch,
      excludeFromSitemap: page.excludeFromSitemap,
      blocks: page.blocks.map((block) => ({
        blockKey: block.blockKey,
        data: block.data,
        sortOrder: block.sortOrder,
        isHidden: block.isHidden,
        label: block.label,
        anchor: block.anchor,
      })),
      seo: page.seo
        ? {
            title: page.seo.title,
            description: page.seo.description,
            canonicalUrl: page.seo.canonicalUrl,
            noindex: page.seo.noindex,
            nofollow: page.seo.nofollow,
            ogTitle: page.seo.ogTitle,
            ogDescription: page.seo.ogDescription,
            ogImageId: page.seo.ogImageId,
            twitterCard: page.seo.twitterCard,
            structuredData: page.seo.structuredData,
            keywords: page.seo.keywords,
            changeFrequency: page.seo.changeFrequency,
            priority: page.seo.priority,
          }
        : null,
    };
  }

  /** Recompute and persist whether the working copy differs from what is live. */
  async refreshUnpublishedFlag(pageId: string, tx?: Prisma.TransactionClient): Promise<boolean> {
    const client = tx ?? this.prisma;

    const page = await client.page.findUnique({
      where: { id: pageId },
      select: { publishedVersion: { select: { data: true } } },
    });

    const working = await this.buildSnapshot(pageId, tx);
    const published = (page?.publishedVersion?.data ?? null) as VersionSnapshot | null;
    const changed = hasUnpublishedChanges(working, published);

    await client.page.update({ where: { id: pageId }, data: { hasUnpublishedChanges: changed } });
    return changed;
  }

  /** Ensure a path is unique within a locale. */
  async assertPathAvailable(locale: Locale, path: string, exceptPageId?: string): Promise<void> {
    const existing = await this.prisma.page.findFirst({
      where: { locale, path, ...(exceptPageId ? { NOT: { id: exceptPageId } } : {}) },
      select: { id: true, title: true, deletedAt: true },
    });

    if (existing) {
      throw ApiError.validation([
        {
          field: 'path',
          message: existing.deletedAt
            ? `A deleted page already uses ${path}. Restore it or choose another path.`
            : `"${existing.title}" already uses ${path}.`,
        },
      ]);
    }
  }
}
