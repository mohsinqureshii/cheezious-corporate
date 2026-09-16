import 'server-only';

import type { Locale } from '@cheezious/config';
import { collectMediaReferences, collectPageReferences } from '@cheezious/page-builder';

import { apiFetch } from './api';
import type { CorporatePage, MediaImage } from './content';

/**
 * Reference resolution.
 *
 * Blocks store ids, not URLs and not copies of images. Before rendering, the ids
 * referenced anywhere on a page are collected and resolved in one batch — so a
 * page with twelve images costs one lookup, not twelve, and an internal link
 * still resolves correctly after the target page has been renamed.
 */

/** Every media asset referenced by a page's blocks and SEO, in one request. */
export async function collectPageImages(page: CorporatePage): Promise<Map<string, MediaImage>> {
  const ids = new Set<string>();
  for (const block of page.blocks) collectMediaReferences(block.data, ids);
  if (page.seo?.ogImageId) ids.add(page.seo.ogImageId);

  return resolveImages([...ids]);
}

export async function resolveImages(ids: string[]): Promise<Map<string, MediaImage>> {
  if (ids.length === 0) return new Map();

  try {
    const { assets } = await apiFetch<{ assets: MediaImage[] }>('/api/public/media/batch', {
      searchParams: { ids: ids.join(',') },
      revalidate: 600,
    });
    return new Map(assets.map((asset) => [asset.id, asset]));
  } catch {
    // An image lookup failure degrades to placeholders rather than a blank page.
    return new Map();
  }
}

/**
 * Resolve internal page references to paths.
 *
 * This is why links survive renames: the block holds a page id, and the path is
 * looked up at render time from whatever that page's path is *now*.
 */
export async function resolvePageReferences(page: CorporatePage, locale: Locale): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const block of page.blocks) collectPageReferences(block.data, ids);
  if (ids.size === 0) return new Map();

  try {
    const { pages } = await apiFetch<{ pages: Array<{ id: string; path: string }> }>(
      `/api/public/${locale}/pages/batch`,
      { searchParams: { ids: [...ids].join(',') }, revalidate: 600 },
    );
    return new Map(pages.map((item) => [item.id, item.path]));
  } catch {
    return new Map();
  }
}
